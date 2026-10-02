-- =====================================================================
-- MECHmetriQ — Smart Quote v1: instant estimate on upload
-- =====================================================================
-- 1. A STEP file is analysed as soon as it is uploaded, before an RFQ
--    exists → cad_analyses.rfq_id becomes optional; thumbnail_path added.
-- 2. RFQs carry the estimate (computed server-side) and the price an admin
--    confirms. A trigger stops buyers writing any price field.
-- 3. sq_settings holds every pricing rate (admin-editable, readable by all
--    so the quote page can update prices live).
-- =====================================================================

-- 1 ------------------------------------------------------------------
alter table public.cad_analyses alter column rfq_id drop not null;
alter table public.cad_analyses add column if not exists thumbnail_path text;

-- 2 ------------------------------------------------------------------
alter table public.rfqs
  add column if not exists rm_grade_id          uuid references public.rm_grades (id),
  add column if not exists analysis_id          uuid references public.cad_analyses (id) on delete set null,
  add column if not exists price_tier           text,
  add column if not exists price_status         text not null default 'none'
                                                check (price_status in ('none', 'estimated', 'confirmed')),
  add column if not exists estimate             jsonb,
  add column if not exists estimated_unit_price numeric(12, 2),
  add column if not exists estimated_total      numeric(12, 2),
  add column if not exists estimated_lead_days  integer,
  add column if not exists confirmed_unit_price numeric(12, 2),
  add column if not exists confirmed_total      numeric(12, 2),
  add column if not exists confirmed_lead_days  integer,
  add column if not exists confirmed_at         timestamptz,
  add column if not exists confirmed_by         uuid references public.profiles (id),
  add column if not exists price_note           text;

create index if not exists rfqs_price_status_idx on public.rfqs (price_status);
create index if not exists rfqs_analysis_id_idx on public.rfqs (analysis_id);
create index if not exists rfqs_rm_grade_id_idx on public.rfqs (rm_grade_id);

-- Buyers own their RFQ rows (insert/update policies), so guard the price
-- fields: only the server (service role) or an admin may set them.
create or replace function public.rfqs_guard_price_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or is_admin() or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.price_status <> 'none' or new.estimate is not null or new.analysis_id is not null
       or new.price_tier is not null
       or new.estimated_unit_price is not null or new.estimated_total is not null or new.estimated_lead_days is not null
       or new.confirmed_unit_price is not null or new.confirmed_total is not null or new.confirmed_lead_days is not null
       or new.confirmed_at is not null or new.confirmed_by is not null or new.price_note is not null then
      raise exception 'Price fields can only be set by MECHmetriQ.' using errcode = '42501';
    end if;
  else
    if new.price_status is distinct from old.price_status
       or new.estimate is distinct from old.estimate
       or new.analysis_id is distinct from old.analysis_id
       or new.price_tier is distinct from old.price_tier
       or new.estimated_unit_price is distinct from old.estimated_unit_price
       or new.estimated_total is distinct from old.estimated_total
       or new.estimated_lead_days is distinct from old.estimated_lead_days
       or new.confirmed_unit_price is distinct from old.confirmed_unit_price
       or new.confirmed_total is distinct from old.confirmed_total
       or new.confirmed_lead_days is distinct from old.confirmed_lead_days
       or new.confirmed_at is distinct from old.confirmed_at
       or new.confirmed_by is distinct from old.confirmed_by
       or new.price_note is distinct from old.price_note
       or new.quantity is distinct from old.quantity and old.price_status <> 'none'
       or new.rm_grade_id is distinct from old.rm_grade_id and old.price_status <> 'none' then
      raise exception 'Price fields can only be changed by MECHmetriQ.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_rfqs_guard_price on public.rfqs;
create trigger trg_rfqs_guard_price before insert or update on public.rfqs
  for each row execute function public.rfqs_guard_price_fields();

-- 3 ------------------------------------------------------------------
create table if not exists public.sq_settings (
  id         smallint primary key default 1 check (id = 1),
  config     jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

comment on table public.sq_settings is
  'Smart Quote pricing rates (single row). Edited in Admin → Smart Quote rates.';

create trigger trg_sq_settings_updated before update on public.sq_settings
  for each row execute function set_updated_at();

alter table public.sq_settings enable row level security;
create policy "sq_settings_read" on public.sq_settings for select using (true);
create policy "sq_settings_admin_update" on public.sq_settings for update to authenticated
  using ((select is_admin())) with check ((select is_admin()));

insert into public.sq_settings (id, config) values (1, '{
  "currency": "INR",
  "margin_pct": 25,
  "min_order_value": 1500,
  "milling_rate_per_hr": 900,
  "turning_rate_per_hr": 700,
  "setup_min_per_setup": 30,
  "programming_min": 45,
  "handling_min_per_part": 2,
  "hours_per_day": 8,
  "machines_in_parallel": 3,
  "stock_allowance_mm": 3,
  "scrap_pct": 10,
  "base_mrr_cm3_per_min": 25,
  "base_finish_cm2_per_min": 40,
  "material_time_factor": {
    "aluminium": 1, "brass": 1.2, "copper": 1.8, "bronze": 1.8,
    "mild-steel": 2.5, "carbon-steel": 2.8, "alloy-steel": 3.5, "spring-steel": 3.5,
    "stainless-steel": 4, "tool-steel": 4.5, "titanium": 6, "nickel-alloys": 8
  },
  "feature_minutes": {
    "hole": 1, "thread": 2, "pocket": 3, "slot": 2.5, "boss": 2,
    "edge": 0.2, "turning": 0.8, "thin": 4, "freeform": 8, "cross": 4
  },
  "feature_cap_minutes": {
    "hole": 30, "thread": 20, "pocket": 12, "slot": 10, "boss": 8,
    "edge": 5, "turning": 8, "thin": 10, "freeform": 20, "cross": 10
  },
  "candidate_weight": 0.5,
  "tolerance_multiplier": {
    "±0.010\" (±0.25mm)": 1,
    "±0.005\" (±0.13mm)": 1.15,
    "Tighter than ±0.005\" (±0.13mm)": 1.4
  },
  "roughness_multiplier": {
    "125μin / 3.2μm Ra": 1,
    "63μin / 1.6μm Ra": 1.1,
    "32μin / 0.8μm Ra": 1.25,
    "16μin / 0.4μm Ra": 1.5
  },
  "thread_min_each": 2,
  "insert_min_each": 1.5,
  "insert_cost_each": 25,
  "finish_rate_per_dm2": {
    "anodize": 15, "hard_anodize": 25, "chem_film": 12, "plating": 30,
    "powder_coat": 20, "bead_blast": 8, "tumbled": 5, "heat_treat": 20,
    "electropolish": 20, "cerakote": 30, "other": 15
  },
  "finish_min_lot": 800,
  "finish_extra_days": 3,
  "inspection_fee": {
    "Standard Inspection": 0,
    "Formal Inspection with Dimensional Report": 1500,
    "CMM Inspection with Dimensional Report": 3000,
    "First Article Inspection Report (FAIR AS9102)": 6000,
    "Source Inspection": 2500,
    "Build and Hold First Article Inspection": 4000,
    "Custom Inspection": 2500
  },
  "certificate_fee": 500,
  "marking_fee_per_part": 10,
  "tiers": [
    {"key": "economy",  "label": "Least expensive", "days": 15, "multiplier": 0.9},
    {"key": "standard", "label": "Standard",        "days": 10, "multiplier": 1.0},
    {"key": "express",  "label": "Fastest",         "days": 5,  "multiplier": 1.5}
  ]
}'::jsonb)
on conflict (id) do nothing;
