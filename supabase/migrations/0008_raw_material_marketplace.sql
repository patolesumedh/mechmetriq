-- =====================================================================
-- MECHmetrIQ — Raw Material Marketplace (Engine B, v2)
--
-- Platform-priced catalogue, modelled on shape → material → grade → size:
--   rm_shapes / rm_materials / rm_grades     catalogue (public read)
--   rm_shape_materials                       which materials each shape is sold in
--   rm_rates (+ rm_rate_history)             admin rate card, ₹/kg excl. GST
--   rm_settings                              cut charges, MTC fee, bulk tiers, min order
--   rm_vendor_supply                         what each raw-material vendor can supply
--   rm_cart_items                            buyer cart (dimensions only — never prices)
--
-- Pricing is computed ONLY in the database (rm_price_line), so a buyer
-- cannot send their own price: the cart stores dimensions, and
-- rm_place_order re-prices everything from the rate card.
--
-- Order flow (reuses orders / order_items, order_type = 'raw_material'):
--   draft          placed by buyer, proforma issued, awaiting approval
--   quoted         approved by admin (vendor assigned, freight set) → pay
--   accepted_paid  paid → vendor fulfils (in_production → shipped → delivered)
--   cancelled      rejected by admin or cancelled by buyer before payment
--
-- Data-quality rule (fixes the wrong-grade problem seen on MetaleMart):
-- every grade belongs to exactly one material (FK, not free text), and a
-- line can only be priced when grade.material ∈ materials offered for that
-- shape and the shape is allowed for that grade.
--
-- Additive: safe to apply while the previous app version is live. The only
-- change to existing objects is orders.vendor_id becoming nullable (an RM
-- order has no vendor until it is approved) and new nullable columns.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Catalogue
-- ---------------------------------------------------------------------
create table if not exists public.rm_shapes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  family text not null check (family in ('bar', 'flat', 'pipe', 'section', 'wire')),
  -- which weight formula applies (implemented in rm_piece_weight_kg and
  -- mirrored in src/lib/rawMaterials/weight.ts for the live preview)
  formula text not null check (formula in (
    'round_bar', 'square_bar', 'hex_bar', 'flat_bar', 'sheet', 'perforated',
    'coil', 'round_tube', 'square_tube', 'rect_tube', 'equal_angle', 't_section',
    'ismc', 'wire'
  )),
  sell_by text not null default 'piece' check (sell_by in ('piece', 'kg')),
  hsn_key text not null check (hsn_key in ('bar', 'flat', 'section', 'seamless', 'welded', 'wire')),
  description text not null default '',
  -- [{ "key": "d", "label": "Diameter", "unit": "mm", "std": [6, 8, ...], "min": 3, "max": 500 }]
  dims jsonb not null default '[]',
  -- standard stock lengths (mm) for piece-sold long products; ordering any
  -- other length means cut-to-length
  std_lengths numeric[] not null default '{}',
  -- standard sheet sizes as [[width, length], ...] for sheet-type shapes
  std_sheet_sizes jsonb not null default '[]',
  rate_premium_pct numeric(5, 2) not null default 0, -- added on top of the grade base rate
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rm_materials (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text,
  density numeric(6, 3) not null check (density > 0),        -- g/cm³, default for grades
  hsn_codes jsonb not null default '{}',                    -- { bar, flat, section, seamless, welded, wire }
  gst_rate numeric(4, 2) not null default 18,
  description text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rm_grades (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.rm_materials (id) on delete restrict,
  slug text not null,
  name text not null,
  equivalents text,                 -- e.g. "UNS S30400 · EN 1.4301 · AISI 304"
  description text not null default '',
  applications text,
  density numeric(6, 3) check (density > 0),  -- null → material density
  mtc_available boolean not null default true,
  shape_slugs text[],               -- null → every shape offered for the material
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (material_id, slug)
);
create index if not exists rm_grades_material_idx on public.rm_grades (material_id);

create table if not exists public.rm_shape_materials (
  shape_id uuid not null references public.rm_shapes (id) on delete cascade,
  material_id uuid not null references public.rm_materials (id) on delete cascade,
  primary key (shape_id, material_id)
);
create index if not exists rm_shape_materials_material_idx on public.rm_shape_materials (material_id);

-- ---------------------------------------------------------------------
-- 2. Rate card (₹/kg, excl. GST). One base rate per grade; an optional
--    per-shape row overrides base × (1 + shape premium).
-- ---------------------------------------------------------------------
create table if not exists public.rm_rates (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references public.rm_grades (id) on delete cascade,
  shape_id uuid references public.rm_shapes (id) on delete cascade,
  rate_per_kg numeric(12, 2) not null check (rate_per_kg > 0),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create unique index if not exists rm_rates_base_uidx on public.rm_rates (grade_id) where shape_id is null;
create unique index if not exists rm_rates_shape_uidx on public.rm_rates (grade_id, shape_id) where shape_id is not null;
create index if not exists rm_rates_shape_idx on public.rm_rates (shape_id);

create table if not exists public.rm_rate_history (
  id bigint generated always as identity primary key,
  grade_id uuid not null references public.rm_grades (id) on delete cascade,
  shape_id uuid references public.rm_shapes (id) on delete cascade,
  old_rate numeric(12, 2),
  new_rate numeric(12, 2),
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists rm_rate_history_grade_idx on public.rm_rate_history (grade_id, changed_at desc);
create index if not exists rm_rate_history_shape_idx on public.rm_rate_history (shape_id);
create index if not exists rm_rate_history_changed_by_idx on public.rm_rate_history (changed_by);
create index if not exists rm_rates_updated_by_idx on public.rm_rates (updated_by);

create or replace function public.rm_track_rate_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'INSERT' or new.rate_per_kg is distinct from old.rate_per_kg then
    insert into rm_rate_history (grade_id, shape_id, old_rate, new_rate, changed_by)
    values (new.grade_id, new.shape_id,
            case when tg_op = 'UPDATE' then old.rate_per_kg end,
            new.rate_per_kg, auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists trg_rm_rates_track on public.rm_rates;
create trigger trg_rm_rates_track before insert or update on public.rm_rates
  for each row execute function public.rm_track_rate_change();

-- ---------------------------------------------------------------------
-- 3. Marketplace settings (single row)
-- ---------------------------------------------------------------------
create table if not exists public.rm_settings (
  id smallint primary key default 1 check (id = 1),
  cut_charge_per_cut numeric(10, 2) not null default 50,   -- ₹ per piece cut
  cut_charge_per_kg numeric(10, 2) not null default 5,     -- ₹ per kg cut
  mtc_fee numeric(10, 2) not null default 250,             -- ₹ per line with MTC
  min_order_value numeric(12, 2) not null default 2000,    -- ₹, before GST
  -- [{ "min_kg": 500, "pct": 1.5 }, ...] applied on order material value
  bulk_tiers jsonb not null default '[{"min_kg":500,"pct":1.5},{"min_kg":1000,"pct":3},{"min_kg":5000,"pct":5}]',
  freight_gst_rate numeric(4, 2) not null default 18,
  updated_at timestamptz not null default now()
);
insert into public.rm_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 4. Vendor supply declarations (replaces vendor-set listings for pricing)
-- ---------------------------------------------------------------------
create table if not exists public.rm_vendor_supply (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendor_profiles (id) on delete cascade,
  shape_id uuid not null references public.rm_shapes (id) on delete cascade,
  grade_id uuid not null references public.rm_grades (id) on delete cascade,
  warehouse_pincode text check (warehouse_pincode ~ '^[1-9][0-9]{5}$'),
  size_range text,         -- free text, e.g. "Ø6–150 mm"
  mtc_available boolean not null default true,
  cut_to_size boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (vendor_id, shape_id, grade_id)
);
create index if not exists rm_vendor_supply_lookup_idx on public.rm_vendor_supply (shape_id, grade_id) where active;
create index if not exists rm_vendor_supply_grade_idx on public.rm_vendor_supply (grade_id);

-- ---------------------------------------------------------------------
-- 5. Cart — dimensions only; prices are always recomputed
-- ---------------------------------------------------------------------
create table if not exists public.rm_cart_items (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  shape_id uuid not null references public.rm_shapes (id) on delete cascade,
  grade_id uuid not null references public.rm_grades (id) on delete cascade,
  dims jsonb not null,
  length_mm numeric(10, 2),
  quantity numeric(12, 3) not null check (quantity > 0),  -- pieces, or kg for sell_by = 'kg'
  mtc boolean not null default false,
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists rm_cart_items_buyer_idx on public.rm_cart_items (buyer_id, created_at);
create index if not exists rm_cart_items_shape_idx on public.rm_cart_items (shape_id);
create index if not exists rm_cart_items_grade_idx on public.rm_cart_items (grade_id);

-- ---------------------------------------------------------------------
-- 6. Orders: RM columns (all nullable → no effect on custom-part orders)
-- ---------------------------------------------------------------------
alter table public.orders alter column vendor_id drop not null;
alter table public.orders
  add column if not exists rm_total_weight_kg numeric(12, 3),
  add column if not exists rm_material_value numeric(12, 2),
  add column if not exists rm_bulk_discount numeric(12, 2),
  add column if not exists rm_cut_charges numeric(12, 2),
  add column if not exists rm_mtc_charges numeric(12, 2),
  add column if not exists rm_admin_note text,
  add column if not exists rm_approved_at timestamptz,
  add column if not exists rm_approved_by uuid references public.profiles (id) on delete set null,
  add column if not exists rm_paid_at timestamptz;
create index if not exists idx_orders_rm_approved_by on public.orders (rm_approved_by);

alter table public.order_items
  add column if not exists rm_line_no smallint,
  add column if not exists rm_shape_id uuid references public.rm_shapes (id) on delete set null,
  add column if not exists rm_grade_id uuid references public.rm_grades (id) on delete set null,
  add column if not exists rm_dims jsonb,
  add column if not exists rm_length_mm numeric(10, 2),
  add column if not exists rm_sell_by text,
  add column if not exists rm_piece_weight_kg numeric(12, 4),
  add column if not exists rm_weight_kg numeric(12, 3),
  add column if not exists rm_rate_per_kg numeric(12, 2),
  add column if not exists rm_material_value numeric(12, 2),
  add column if not exists rm_cut boolean,
  add column if not exists rm_cut_charge numeric(12, 2),
  add column if not exists rm_mtc boolean,
  add column if not exists rm_mtc_fee numeric(12, 2),
  add column if not exists rm_discount numeric(12, 2),
  add column if not exists rm_taxable_value numeric(12, 2),
  add column if not exists rm_hsn_code text,
  add column if not exists rm_gst_rate numeric(4, 2);
create index if not exists idx_order_items_rm_shape on public.order_items (rm_shape_id);
create index if not exists idx_order_items_rm_grade on public.order_items (rm_grade_id);

-- ---------------------------------------------------------------------
-- 7. Weight + price (single source of truth)
-- ---------------------------------------------------------------------

-- Nominal kg/m for Indian standard medium-weight channels (IS 808:1989).
create or replace function public.rm_ismc_kg_per_m(p_size numeric)
returns numeric
language sql
immutable
set search_path = public
as $$
  select (jsonb_build_object(
    '75', 7.14, '100', 9.56, '125', 13.1, '150', 16.8, '175', 19.6,
    '200', 22.3, '225', 26.1, '250', 30.6, '300', 36.3, '350', 42.1, '400', 50.1
  ) ->> (trim(to_char(p_size, 'FM9999'))))::numeric;
$$;

-- Theoretical weight of ONE piece in kg (dims + length in mm, density g/cm³).
-- For sell_by = 'kg' shapes (coil, wire) returns null: the buyer orders kg.
create or replace function public.rm_piece_weight_kg(
  p_formula text, p_dims jsonb, p_length_mm numeric, p_density numeric
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  d  numeric := (p_dims ->> 'd')::numeric;
  a  numeric := (p_dims ->> 'a')::numeric;
  b  numeric := (p_dims ->> 'b')::numeric;
  h  numeric := (p_dims ->> 'h')::numeric;
  t  numeric := (p_dims ->> 't')::numeric;
  w  numeric := (p_dims ->> 'w')::numeric;
  l  numeric := (p_dims ->> 'l')::numeric;
  od numeric := (p_dims ->> 'od')::numeric;
  af numeric := (p_dims ->> 'af')::numeric;
  op numeric := coalesce((p_dims ->> 'open')::numeric, 0);
  sz numeric := (p_dims ->> 'size')::numeric;
  k  numeric := p_density / 1000000.0;  -- kg per mm³
  area numeric;                           -- mm²
begin
  case p_formula
    when 'coil', 'wire' then
      return null;
    when 'sheet' then
      return round(t * w * l * k, 4);
    when 'perforated' then
      return round(t * w * l * (1 - op / 100.0) * k, 4);
    when 'ismc' then
      return round(public.rm_ismc_kg_per_m(sz) * p_length_mm / 1000.0, 4);
    else
      null;
  end case;

  area := case p_formula
    when 'round_bar'   then pi() / 4 * d * d
    when 'square_bar'  then a * a
    when 'hex_bar'     then sqrt(3) / 2 * af * af
    when 'flat_bar'    then w * t
    when 'round_tube'  then pi() * (od - t) * t
    when 'square_tube' then 4 * t * (a - t)
    when 'rect_tube'   then 2 * t * (a + b - 2 * t)
    when 'equal_angle' then t * (2 * a - t)
    when 't_section'   then t * (b + h - t)
  end;
  if area is null then
    raise exception 'unknown shape formula %', p_formula;
  end if;
  return round(area * p_length_mm * k, 4);
end;
$$;

-- Validates dimensions against the shape definition; raises with a
-- human-readable message on the first problem.
create or replace function public.rm_validate_dims(p_shape public.rm_shapes, p_dims jsonb, p_length_mm numeric)
returns void
language plpgsql
immutable
set search_path = public
as $$
declare
  spec jsonb;
  v numeric;
  t numeric := (p_dims ->> 't')::numeric;
begin
  for spec in select * from jsonb_array_elements(p_shape.dims) loop
    begin
      v := (p_dims ->> (spec ->> 'key'))::numeric;
    exception when others then
      raise exception '% must be a number', spec ->> 'label';
    end;
    if v is null or v <= 0 then
      raise exception '% is required', spec ->> 'label';
    end if;
    if spec ? 'min' and v < (spec ->> 'min')::numeric then
      raise exception '% must be at least % %', spec ->> 'label', spec ->> 'min', coalesce(spec ->> 'unit', '');
    end if;
    if spec ? 'max' and v > (spec ->> 'max')::numeric then
      raise exception '% must be at most % %', spec ->> 'label', spec ->> 'max', coalesce(spec ->> 'unit', '');
    end if;
  end loop;

  if p_shape.formula = 'ismc' and public.rm_ismc_kg_per_m((p_dims ->> 'size')::numeric) is null then
    raise exception 'Unknown ISMC size';
  end if;
  if p_shape.formula = 'round_tube' and t * 2 >= (p_dims ->> 'od')::numeric then
    raise exception 'Wall thickness must be less than half the outer diameter';
  end if;
  if p_shape.formula in ('square_tube', 'equal_angle') and t * 2 >= (p_dims ->> 'a')::numeric then
    raise exception 'Thickness must be less than half the side';
  end if;
  if p_shape.formula = 'rect_tube'
     and t * 2 >= least((p_dims ->> 'a')::numeric, (p_dims ->> 'b')::numeric) then
    raise exception 'Wall thickness must be less than half the smaller side';
  end if;
  if p_shape.formula = 't_section'
     and (t >= (p_dims ->> 'b')::numeric or t >= (p_dims ->> 'h')::numeric) then
    raise exception 'Thickness must be less than flange width and height';
  end if;
  if p_shape.formula = 'flat_bar' and t > (p_dims ->> 'w')::numeric then
    raise exception 'Thickness cannot exceed width';
  end if;

  if p_shape.sell_by = 'piece' and p_shape.formula not in ('sheet', 'perforated') then
    if p_length_mm is null or p_length_mm < 10 or p_length_mm > 12000 then
      raise exception 'Length must be between 10 and 12,000 mm';
    end if;
  end if;
end;
$$;

-- Prices one line. Every money figure the buyer ever sees comes from here.
create or replace function public.rm_price_line(
  p_shape_id uuid, p_grade_id uuid, p_dims jsonb, p_length_mm numeric,
  p_quantity numeric, p_mtc boolean
)
returns table (
  description text, sell_by text, piece_weight_kg numeric, weight_kg numeric,
  rate_per_kg numeric, material_value numeric, cut boolean, cut_charge numeric,
  mtc_fee numeric, hsn_code text, gst_rate numeric, length_mm numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  s public.rm_shapes;
  g public.rm_grades;
  m public.rm_materials;
  cfg public.rm_settings;
  dens numeric;
  rate numeric;
  pw numeric;
  wt numeric;
  is_cut boolean := false;
  qty numeric := p_quantity;
  len numeric := p_length_mm;
  dim_label text;
begin
  select * into s from rm_shapes where id = p_shape_id and active;
  if not found then raise exception 'This shape is not available'; end if;
  select * into g from rm_grades where id = p_grade_id and active;
  if not found then raise exception 'This grade is not available'; end if;
  select * into m from rm_materials where id = g.material_id and active;
  if not found then raise exception 'This material is not available'; end if;
  if not exists (select 1 from rm_shape_materials sm where sm.shape_id = s.id and sm.material_id = m.id) then
    raise exception '% is not sold as %', m.name, s.name;
  end if;
  if g.shape_slugs is not null and not (s.slug = any (g.shape_slugs)) then
    raise exception '% is not available as %', g.name, s.name;
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  if s.sell_by = 'piece' and p_quantity <> trunc(p_quantity) then
    raise exception 'Quantity must be a whole number of pieces';
  end if;
  if s.sell_by = 'piece' and p_quantity > 10000 then
    raise exception 'For more than 10,000 pieces please contact us';
  end if;
  if s.sell_by = 'kg' and (p_quantity < 10 or p_quantity > 100000) then
    raise exception 'Quantity must be between 10 and 100,000 kg';
  end if;
  if p_mtc and not g.mtc_available then
    raise exception 'MTC is not available for %', g.name;
  end if;

  if s.formula in ('sheet', 'perforated', 'coil', 'wire') then
    len := null;
  end if;
  perform rm_validate_dims(s, p_dims, len);

  select * into cfg from rm_settings where id = 1;
  dens := coalesce(g.density, m.density);

  select r.rate_per_kg into rate from rm_rates r where r.grade_id = g.id and r.shape_id = s.id;
  if rate is null then
    select round(r.rate_per_kg * (1 + s.rate_premium_pct / 100.0), 2) into rate
    from rm_rates r where r.grade_id = g.id and r.shape_id is null;
  end if;
  if rate is null then
    raise exception 'No rate is set for % %. Please contact us for a quote.', g.name, s.name;
  end if;

  if s.sell_by = 'kg' then
    pw := null;
    wt := round(qty, 3);
  else
    pw := rm_piece_weight_kg(s.formula, p_dims, len, dens);
    wt := round(pw * qty, 3);
    if s.formula in ('sheet', 'perforated') then
      is_cut := not exists (
        select 1 from jsonb_array_elements(s.std_sheet_sizes) z
        where (z ->> 0)::numeric = (p_dims ->> 'w')::numeric
          and (z ->> 1)::numeric = (p_dims ->> 'l')::numeric
      );
    else
      is_cut := not (len = any (s.std_lengths));
    end if;
  end if;

  dim_label := case s.formula
    when 'round_bar'   then 'Ø' || (p_dims ->> 'd') || ' mm'
    when 'wire'        then 'Ø' || (p_dims ->> 'd') || ' mm'
    when 'square_bar'  then (p_dims ->> 'a') || ' × ' || (p_dims ->> 'a') || ' mm'
    when 'hex_bar'     then (p_dims ->> 'af') || ' mm A/F'
    when 'flat_bar'    then (p_dims ->> 'w') || ' × ' || (p_dims ->> 't') || ' mm'
    when 'sheet'       then (p_dims ->> 't') || ' mm × ' || (p_dims ->> 'w') || ' × ' || (p_dims ->> 'l') || ' mm'
    when 'perforated'  then (p_dims ->> 't') || ' mm × ' || (p_dims ->> 'w') || ' × ' || (p_dims ->> 'l') || ' mm, ' || coalesce(p_dims ->> 'open', '0') || '% open'
    when 'coil'        then (p_dims ->> 't') || ' mm × ' || (p_dims ->> 'w') || ' mm wide'
    when 'round_tube'  then 'OD ' || (p_dims ->> 'od') || ' × ' || (p_dims ->> 't') || ' mm wall'
    when 'square_tube' then (p_dims ->> 'a') || ' × ' || (p_dims ->> 'a') || ' × ' || (p_dims ->> 't') || ' mm'
    when 'rect_tube'   then (p_dims ->> 'a') || ' × ' || (p_dims ->> 'b') || ' × ' || (p_dims ->> 't') || ' mm'
    when 'equal_angle' then (p_dims ->> 'a') || ' × ' || (p_dims ->> 'a') || ' × ' || (p_dims ->> 't') || ' mm'
    when 't_section'   then (p_dims ->> 'b') || ' × ' || (p_dims ->> 'h') || ' × ' || (p_dims ->> 't') || ' mm'
    when 'ismc'        then 'ISMC ' || (p_dims ->> 'size')
  end;

  description := g.name || ' ' || s.name || ' — ' || dim_label
    || case when len is not null then ', ' || trim(to_char(len, 'FM999990.##')) || ' mm long' else '' end;
  sell_by := s.sell_by;
  piece_weight_kg := pw;
  weight_kg := wt;
  rate_per_kg := rate;
  material_value := round(wt * rate, 2);
  cut := is_cut;
  cut_charge := case when is_cut
    then round(greatest(qty * cfg.cut_charge_per_cut, wt * cfg.cut_charge_per_kg), 2) else 0 end;
  mtc_fee := case when p_mtc then cfg.mtc_fee else 0 end;
  hsn_code := m.hsn_codes ->> s.hsn_key;
  gst_rate := m.gst_rate;
  length_mm := len;
  return next;
end;
$$;

-- Bulk discount % for a total order weight.
create or replace function public.rm_bulk_pct(p_weight_kg numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max((t ->> 'pct')::numeric), 0)
  from rm_settings s, jsonb_array_elements(s.bulk_tiers) t
  where s.id = 1 and p_weight_kg >= (t ->> 'min_kg')::numeric;
$$;

-- Current buyer's cart, fully priced. Lines that can no longer be priced
-- (grade withdrawn, rate missing) come back with error set.
create or replace function public.rm_cart_quote()
returns table (
  cart_item_id uuid, shape_id uuid, grade_id uuid, dims jsonb, quantity numeric, mtc boolean,
  notes text, description text, sell_by text, piece_weight_kg numeric, weight_kg numeric,
  rate_per_kg numeric, material_value numeric, cut boolean, cut_charge numeric, mtc_fee numeric,
  hsn_code text, gst_rate numeric, length_mm numeric, error text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  c public.rm_cart_items;
  p record;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  for c in select * from rm_cart_items where buyer_id = auth.uid() order by created_at loop
    cart_item_id := c.id; shape_id := c.shape_id; grade_id := c.grade_id; dims := c.dims;
    quantity := c.quantity; mtc := c.mtc; notes := c.notes; error := null;
    begin
      select * into p from rm_price_line(c.shape_id, c.grade_id, c.dims, c.length_mm, c.quantity, c.mtc);
      description := p.description; sell_by := p.sell_by; piece_weight_kg := p.piece_weight_kg;
      weight_kg := p.weight_kg; rate_per_kg := p.rate_per_kg; material_value := p.material_value;
      cut := p.cut; cut_charge := p.cut_charge; mtc_fee := p.mtc_fee; hsn_code := p.hsn_code;
      gst_rate := p.gst_rate; length_mm := p.length_mm;
    exception when others then
      description := null; sell_by := null; piece_weight_kg := null; weight_kg := null;
      rate_per_kg := null; material_value := null; cut := null; cut_charge := null;
      mtc_fee := null; hsn_code := null; gst_rate := null; length_mm := c.length_mm;
      error := sqlerrm;
    end;
    return next;
  end loop;
end;
$$;

-- Adds a line to the cart after validating it prices correctly.
create or replace function public.rm_add_to_cart(
  p_shape_id uuid, p_grade_id uuid, p_dims jsonb, p_length_mm numeric,
  p_quantity numeric, p_mtc boolean, p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  clean_dims jsonb;
begin
  if auth.uid() is null then raise exception 'Please log in to add items to your cart'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and role = 'buyer') then
    raise exception 'Only buyer accounts can place marketplace orders';
  end if;
  if (select count(*) from rm_cart_items where buyer_id = auth.uid()) >= 50 then
    raise exception 'Your cart is full (50 lines). Place an order or remove some lines first.';
  end if;

  -- keep only the keys the shape defines (no arbitrary payloads stored)
  select coalesce(jsonb_object_agg(k, p_dims -> k), '{}') into clean_dims
  from rm_shapes s, jsonb_array_elements(s.dims) spec, lateral (select spec ->> 'key' as k) x
  where s.id = p_shape_id and p_dims ? k;

  perform * from rm_price_line(p_shape_id, p_grade_id, clean_dims, p_length_mm, p_quantity, coalesce(p_mtc, false));

  insert into rm_cart_items (buyer_id, shape_id, grade_id, dims, length_mm, quantity, mtc, notes)
  values (auth.uid(), p_shape_id, p_grade_id, clean_dims,
          case when (select formula from rm_shapes where id = p_shape_id) in ('sheet', 'perforated', 'coil', 'wire')
               then null else p_length_mm end,
          p_quantity, coalesce(p_mtc, false), nullif(trim(p_notes), ''))
  returning id into new_id;
  return new_id;
end;
$$;

-- Turns the cart into one raw-material order with a proforma (status draft).
create or replace function public.rm_place_order(p_address_id uuid, p_billing_gstin text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.rm_settings;
  q record;
  n_lines integer := 0;
  tot_weight numeric := 0;
  tot_material numeric := 0;
  tot_discount numeric := 0;
  tot_cut numeric := 0;
  tot_mtc numeric := 0;
  tot_gst numeric := 0;
  pct numeric;
  line_discount numeric;
  taxable numeric;
  v_subtotal numeric;
  new_order uuid;
  gstin text := upper(nullif(trim(p_billing_gstin), ''));
  line_no smallint := 0;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and role = 'buyer') then
    raise exception 'Only buyer accounts can place marketplace orders';
  end if;
  if not exists (select 1 from addresses where id = p_address_id and profile_id = auth.uid()) then
    raise exception 'Please choose one of your delivery addresses';
  end if;
  if gstin is not null and gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then
    raise exception 'Billing GSTIN is not in a valid format';
  end if;

  select * into cfg from rm_settings where id = 1;

  -- lock the cart so a double-submit cannot create two orders
  perform 1 from rm_cart_items where buyer_id = auth.uid() for update;

  create temp table if not exists _rm_q on commit drop as
    select * from rm_cart_quote() with ordinality limit 0;
  delete from _rm_q;
  insert into _rm_q select * from rm_cart_quote() with ordinality;

  select count(*), coalesce(sum(weight_kg), 0) into n_lines, tot_weight from _rm_q;
  if n_lines = 0 then raise exception 'Your cart is empty'; end if;
  select error into q from _rm_q where error is not null limit 1;
  if found then raise exception 'A cart line can no longer be ordered: %', q.error; end if;

  pct := rm_bulk_pct(tot_weight);

  insert into orders (buyer_id, vendor_id, order_type, status, delivery_address_id, billing_gstin,
                      subtotal, shipping_amount, gst_amount, total_amount)
  values (auth.uid(), null, 'raw_material', 'draft', p_address_id, gstin, 0, 0, 0, 0)
  returning id into new_order;

  for q in select * from _rm_q order by ordinality loop
    line_no := q.ordinality;
    line_discount := round(q.material_value * pct / 100.0, 2);
    taxable := q.material_value - line_discount + q.cut_charge + q.mtc_fee;
    tot_material := tot_material + q.material_value;
    tot_discount := tot_discount + line_discount;
    tot_cut := tot_cut + q.cut_charge;
    tot_mtc := tot_mtc + q.mtc_fee;
    tot_gst := tot_gst + round(taxable * q.gst_rate / 100.0, 2);
    insert into order_items (order_id, description, quantity, unit_price, line_total, rm_line_no,
      rm_shape_id, rm_grade_id, rm_dims, rm_length_mm, rm_sell_by, rm_piece_weight_kg, rm_weight_kg,
      rm_rate_per_kg, rm_material_value, rm_cut, rm_cut_charge, rm_mtc, rm_mtc_fee,
      rm_discount, rm_taxable_value, rm_hsn_code, rm_gst_rate)
    values (new_order,
      q.description || case when q.notes is not null then ' (note: ' || q.notes || ')' else '' end,
      q.quantity,
      case when q.sell_by = 'kg' then q.rate_per_kg else round(q.material_value / q.quantity, 2) end,
      q.material_value, line_no, q.shape_id, q.grade_id, q.dims, q.length_mm, q.sell_by, q.piece_weight_kg,
      q.weight_kg, q.rate_per_kg, q.material_value, q.cut, q.cut_charge, q.mtc, q.mtc_fee,
      line_discount, taxable, q.hsn_code, q.gst_rate);
  end loop;

  v_subtotal := tot_material - tot_discount + tot_cut + tot_mtc;
  if v_subtotal < cfg.min_order_value then
    raise exception 'Minimum order value is ₹% before GST', cfg.min_order_value;
  end if;

  update orders set
    subtotal = v_subtotal, gst_amount = tot_gst, total_amount = v_subtotal + tot_gst,
    rm_total_weight_kg = tot_weight, rm_material_value = tot_material, rm_bulk_discount = tot_discount,
    rm_cut_charges = tot_cut, rm_mtc_charges = tot_mtc
  where id = new_order;

  delete from rm_cart_items where buyer_id = auth.uid();
  return new_order;
end;
$$;

-- Admin: approve an RM order — assign vendor, set freight, re-total.
create or replace function public.rm_approve_order(
  p_order_id uuid, p_vendor_id uuid, p_freight numeric, p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  cfg public.rm_settings;
  line_gst numeric;
  freight_gst numeric;
begin
  if not is_admin() then raise exception 'Only admins can approve orders'; end if;
  select * into o from orders where id = p_order_id for update;
  if not found or o.order_type <> 'raw_material' then raise exception 'Order not found'; end if;
  if o.status <> 'draft' then raise exception 'Only orders awaiting approval can be approved'; end if;
  if p_freight is null or p_freight < 0 then raise exception 'Freight must be zero or more'; end if;
  if not exists (
    select 1 from vendor_profiles v
    where v.id = p_vendor_id and v.vendor_type = 'raw_material' and v.kyc_status = 'approved'
  ) then
    raise exception 'Choose a KYC-approved raw material vendor';
  end if;

  select * into cfg from rm_settings where id = 1;
  select coalesce(sum(round(i.rm_taxable_value * i.rm_gst_rate / 100.0, 2)), 0)
    into line_gst
  from order_items i where i.order_id = o.id;
  freight_gst := round(p_freight * cfg.freight_gst_rate / 100.0, 2);

  update orders set
    vendor_id = p_vendor_id,
    shipping_amount = round(p_freight, 2),
    gst_amount = line_gst + freight_gst,
    total_amount = subtotal + round(p_freight, 2) + line_gst + freight_gst,
    status = 'quoted',
    rm_admin_note = nullif(trim(p_note), ''),
    rm_approved_at = now(),
    rm_approved_by = auth.uid()
  where id = o.id;
end;
$$;

-- Admin: reject (cancel) an RM order that has not been paid.
create or replace function public.rm_reject_order(p_order_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Only admins can reject orders'; end if;
  if nullif(trim(p_note), '') is null then raise exception 'Give the buyer a reason'; end if;
  update orders set status = 'cancelled', rm_admin_note = trim(p_note)
  where id = p_order_id and order_type = 'raw_material' and status in ('draft', 'quoted');
  if not found then raise exception 'Only unpaid orders can be rejected'; end if;
end;
$$;

-- Buyer: cancel own RM order before payment.
create or replace function public.rm_cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update orders set status = 'cancelled'
  where id = p_order_id and buyer_id = auth.uid() and order_type = 'raw_material'
    and status in ('draft', 'quoted');
  if not found then raise exception 'This order can no longer be cancelled'; end if;
end;
$$;

-- Buyer: pay an approved RM order. Records the payment and moves the order
-- to accepted_paid. NOTE: no payment gateway is wired up yet — this is the
-- hook where the gateway's verified callback should land.
create or replace function public.rm_pay_order(p_order_id uuid, p_method payment_method, p_gateway_ref text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
begin
  select * into o from orders where id = p_order_id for update;
  if not found or o.buyer_id is distinct from auth.uid() or o.order_type <> 'raw_material' then
    raise exception 'Order not found';
  end if;
  if o.status <> 'quoted' then raise exception 'This order is not awaiting payment'; end if;
  insert into payments (order_id, amount, method, status, gateway_ref)
  values (o.id, o.total_amount, p_method, 'success', nullif(trim(p_gateway_ref), ''));
  update orders set status = 'accepted_paid', rm_paid_at = now() where id = o.id;
end;
$$;

-- Admin: vendors able to supply every line of an order.
create or replace function public.rm_eligible_vendors(p_order_id uuid)
returns table (vendor_id uuid, company_name text, warehouse_pincodes text, lines_covered integer, lines_total integer)
language sql
stable
security definer
set search_path = public
as $$
  with lines as (
    select distinct rm_shape_id, rm_grade_id from order_items where order_id = p_order_id
  ), n as (select count(*)::int as total from lines)
  select v.id, v.company_name,
         string_agg(distinct s.warehouse_pincode, ', '),
         count(distinct (s.shape_id, s.grade_id))::int,
         (select total from n)
  from vendor_profiles v
  join rm_vendor_supply s on s.vendor_id = v.id and s.active
  join lines l on l.rm_shape_id = s.shape_id and l.rm_grade_id = s.grade_id
  where is_admin() and v.vendor_type = 'raw_material' and v.kyc_status = 'approved'
  group by v.id, v.company_name
  order by 4 desc, 2;
$$;

-- ---------------------------------------------------------------------
-- 8. Guards: RM orders and their items change only through the functions
--    above (which run as the function owner), plus vendor fulfilment steps.
-- ---------------------------------------------------------------------
create or replace function public.rm_guard_orders()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Function owner (security definer functions), service role, SQL editor → allowed
  if current_user not in ('authenticated', 'anon') or is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.order_type = 'raw_material' then
      raise exception 'Raw material orders must be placed from the cart';
    end if;
    return new;
  end if;

  if old.order_type <> 'raw_material' then
    if new.order_type = 'raw_material' then
      raise exception 'order_type cannot be changed';
    end if;
    return new;
  end if;

  -- Only the assigned vendor may touch an RM order directly, and only to
  -- advance fulfilment and add a tracking number.
  if old.vendor_id is null or old.vendor_id <> auth.uid() then
    raise exception 'Raw material orders can only be changed through the platform';
  end if;
  if (new.status is distinct from old.status and not (
        (old.status = 'accepted_paid' and new.status = 'in_production')
     or (old.status = 'in_production' and new.status in ('qc_ready', 'shipped'))
     or (old.status = 'qc_ready' and new.status = 'shipped')
     or (old.status = 'shipped' and new.status = 'delivered')))
     or (row(new.buyer_id, new.vendor_id, new.order_type, new.subtotal, new.shipping_amount,
             new.gst_amount, new.total_amount, new.delivery_address_id, new.billing_gstin,
             new.invoice_url, new.source_quote_id, new.rm_total_weight_kg, new.rm_material_value,
             new.rm_bulk_discount, new.rm_cut_charges, new.rm_mtc_charges, new.rm_admin_note,
             new.rm_approved_at, new.rm_approved_by, new.rm_paid_at)
         is distinct from
         row(old.buyer_id, old.vendor_id, old.order_type, old.subtotal, old.shipping_amount,
             old.gst_amount, old.total_amount, old.delivery_address_id, old.billing_gstin,
             old.invoice_url, old.source_quote_id, old.rm_total_weight_kg, old.rm_material_value,
             old.rm_bulk_discount, old.rm_cut_charges, old.rm_mtc_charges, old.rm_admin_note,
             old.rm_approved_at, old.rm_approved_by, old.rm_paid_at)) then
    raise exception 'Vendors can only advance fulfilment status and add tracking';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_rm_guard_orders on public.orders;
create trigger trg_rm_guard_orders before insert or update on public.orders
  for each row execute function public.rm_guard_orders();

create or replace function public.rm_guard_order_items()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or is_admin() then
    return coalesce(new, old);
  end if;
  if exists (
    select 1 from orders o
    where o.id = coalesce(new.order_id, old.order_id) and o.order_type = 'raw_material'
  ) then
    raise exception 'Raw material order lines cannot be changed directly';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_rm_guard_order_items on public.order_items;
create trigger trg_rm_guard_order_items before insert or update or delete on public.order_items
  for each row execute function public.rm_guard_order_items();

-- ---------------------------------------------------------------------
-- 9. Row Level Security
-- ---------------------------------------------------------------------
alter table public.rm_shapes enable row level security;
alter table public.rm_materials enable row level security;
alter table public.rm_grades enable row level security;
alter table public.rm_shape_materials enable row level security;
alter table public.rm_rates enable row level security;
alter table public.rm_rate_history enable row level security;
alter table public.rm_settings enable row level security;
alter table public.rm_vendor_supply enable row level security;
alter table public.rm_cart_items enable row level security;

-- Catalogue + rates + settings: public read (the catalogue is browsable
-- signed-out, with prices), admin write.
create policy "rm_shapes_read" on public.rm_shapes for select using (active or (select is_admin()));
create policy "rm_materials_read" on public.rm_materials for select using (active or (select is_admin()));
create policy "rm_grades_read" on public.rm_grades for select using (active or (select is_admin()));
create policy "rm_shape_materials_read" on public.rm_shape_materials for select using (true);
create policy "rm_rates_read" on public.rm_rates for select using (true);
create policy "rm_settings_read" on public.rm_settings for select using (true);

create policy "rm_shapes_admin_write" on public.rm_shapes for insert to authenticated with check ((select is_admin()));
create policy "rm_shapes_admin_update" on public.rm_shapes for update to authenticated using ((select is_admin()));
create policy "rm_materials_admin_write" on public.rm_materials for insert to authenticated with check ((select is_admin()));
create policy "rm_materials_admin_update" on public.rm_materials for update to authenticated using ((select is_admin()));
create policy "rm_grades_admin_write" on public.rm_grades for insert to authenticated with check ((select is_admin()));
create policy "rm_grades_admin_update" on public.rm_grades for update to authenticated using ((select is_admin()));
create policy "rm_shape_materials_admin_write" on public.rm_shape_materials for insert to authenticated with check ((select is_admin()));
create policy "rm_shape_materials_admin_delete" on public.rm_shape_materials for delete to authenticated using ((select is_admin()));
create policy "rm_rates_admin_write" on public.rm_rates for insert to authenticated with check ((select is_admin()));
create policy "rm_rates_admin_update" on public.rm_rates for update to authenticated using ((select is_admin()));
create policy "rm_rates_admin_delete" on public.rm_rates for delete to authenticated using ((select is_admin()));
create policy "rm_settings_admin_update" on public.rm_settings for update to authenticated using ((select is_admin()));
create policy "rm_rate_history_admin_read" on public.rm_rate_history for select to authenticated using ((select is_admin()));

-- Vendor supply: raw-material vendor manages own rows; admin reads all.
create policy "rm_vendor_supply_select" on public.rm_vendor_supply for select to authenticated
  using (vendor_id = (select auth.uid()) or (select is_admin()));
create policy "rm_vendor_supply_insert" on public.rm_vendor_supply for insert to authenticated
  with check (vendor_id = (select auth.uid()) and exists (
    select 1 from public.vendor_profiles v where v.id = (select auth.uid()) and v.vendor_type = 'raw_material'));
create policy "rm_vendor_supply_update" on public.rm_vendor_supply for update to authenticated
  using (vendor_id = (select auth.uid())) with check (vendor_id = (select auth.uid()));
create policy "rm_vendor_supply_delete" on public.rm_vendor_supply for delete to authenticated
  using (vendor_id = (select auth.uid()));

-- Cart: owner only. Inserts go through rm_add_to_cart (validates); direct
-- inserts are not granted. Buyers may change quantity/MTC/notes or delete.
create policy "rm_cart_select_own" on public.rm_cart_items for select to authenticated
  using (buyer_id = (select auth.uid()));
create policy "rm_cart_update_own" on public.rm_cart_items for update to authenticated
  using (buyer_id = (select auth.uid())) with check (buyer_id = (select auth.uid()));
create policy "rm_cart_delete_own" on public.rm_cart_items for delete to authenticated
  using (buyer_id = (select auth.uid()));

revoke all on public.rm_rate_history, public.rm_vendor_supply, public.rm_cart_items from anon;
revoke insert, update, delete on public.rm_shapes, public.rm_materials, public.rm_grades,
  public.rm_shape_materials, public.rm_rates, public.rm_settings from anon;
revoke insert on public.rm_cart_items from authenticated;
revoke update on public.rm_cart_items from authenticated;
grant update (quantity, mtc, notes) on public.rm_cart_items to authenticated;

-- Function execute rights
revoke execute on function public.rm_cart_quote() from public, anon;
revoke execute on function public.rm_add_to_cart(uuid, uuid, jsonb, numeric, numeric, boolean, text) from public, anon;
revoke execute on function public.rm_place_order(uuid, text) from public, anon;
revoke execute on function public.rm_approve_order(uuid, uuid, numeric, text) from public, anon;
revoke execute on function public.rm_reject_order(uuid, text) from public, anon;
revoke execute on function public.rm_cancel_order(uuid) from public, anon;
revoke execute on function public.rm_pay_order(uuid, payment_method, text) from public, anon;
revoke execute on function public.rm_eligible_vendors(uuid) from public, anon;
revoke execute on function public.rm_track_rate_change() from public, anon, authenticated;
grant execute on function public.rm_cart_quote() to authenticated;
grant execute on function public.rm_add_to_cart(uuid, uuid, jsonb, numeric, numeric, boolean, text) to authenticated;
grant execute on function public.rm_place_order(uuid, text) to authenticated;
grant execute on function public.rm_approve_order(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.rm_reject_order(uuid, text) to authenticated;
grant execute on function public.rm_cancel_order(uuid) to authenticated;
grant execute on function public.rm_pay_order(uuid, payment_method, text) to authenticated;
grant execute on function public.rm_eligible_vendors(uuid) to authenticated;
-- rm_price_line / rm_bulk_pct / rm_piece_weight_kg stay callable by anon:
-- they only read public catalogue + rate data (used for signed-out quotes).
