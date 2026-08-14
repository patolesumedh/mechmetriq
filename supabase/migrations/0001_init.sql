-- =====================================================================
-- MECHmetrIQ — initial schema
-- Custom manufacturing (Engine A) + raw materials marketplace (Engine B)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type user_role as enum ('buyer', 'vendor', 'admin');
create type vendor_type as enum ('fabrication', 'raw_material');
create type kyc_status as enum ('draft', 'pending', 'approved', 'rejected', 'on_hold');
create type staff_role as enum ('super_admin', 'ops', 'finance', 'support', 'content');

create type master_item_type as enum ('process', 'material', 'unit', 'finish');
create type master_status as enum ('active', 'inactive');

create type rfq_status as enum ('pending', 'quoted', 'accepted', 'expired', 'cancelled');
create type quote_status as enum ('submitted', 'won', 'lost', 'expired', 'withdrawn');
create type listing_status as enum ('draft', 'pending_review', 'active', 'rejected', 'inactive');

create type order_type as enum ('custom_part', 'raw_material');
create type order_status as enum (
  'draft', 'quoted', 'accepted_paid', 'in_production', 'qc_ready',
  'shipped', 'delivered', 'cancelled', 'refunded', 'disputed'
);

create type payment_method as enum ('upi', 'card', 'netbanking', 'wallet');
create type payment_status as enum ('pending', 'success', 'failed', 'refunded');
create type payout_status as enum ('pending', 'processing', 'paid');
create type dispute_status as enum ('open', 'reviewing', 'resolved');
create type ticket_status as enum ('open', 'in_progress', 'resolved');
create type coupon_type as enum ('percent', 'flat');

-- ---------------------------------------------------------------------
-- Profiles (1:1 with auth.users) + vendor sub-profile
-- ---------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'buyer',
  full_name text not null,
  email text not null,
  phone text,
  phone_verified boolean not null default false,
  email_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table vendor_profiles (
  id uuid primary key references profiles (id) on delete cascade,
  vendor_type vendor_type not null,
  company_name text not null,
  gstin text,
  pan text,
  business_type text,
  registered_address text,
  registered_pincode text,
  -- Fabrication vendors
  capabilities text[] default '{}',        -- process names, e.g. {CNC Machining, Sheet Metal}
  materials_machined text[] default '{}',  -- e.g. {Aluminium, Stainless Steel}
  typical_lead_time text,
  -- Raw material vendors
  categories_supplied text[] default '{}', -- e.g. {Metals, Sheets & Plates}
  materials_handled text[] default '{}',   -- e.g. {Al 6061, SS 304}
  warehouse_pincode text,
  min_order_policy text,
  -- Shared KYC / payout
  certifications_url text,
  bank_account_number text,
  ifsc_code text,
  cancelled_cheque_url text,
  kyc_status kyc_status not null default 'draft',
  kyc_rejection_reason text,
  internal_notes text,                     -- admin-only, never shown to vendor
  commission_override numeric(5, 2),       -- null = use platform default
  category_permissions text[] default '{}',
  rating numeric(2, 1) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table staff_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  role staff_role not null,
  module_permissions jsonb not null default '{}',
  status master_status not null default 'active',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Category & Material Master — the backbone every other form depends on
-- ---------------------------------------------------------------------
create table master_items (
  id uuid primary key default gen_random_uuid(),
  type master_item_type not null,
  name text not null,
  parent_id uuid references master_items (id) on delete set null,
  default_unit text,
  applicable_processes text[] default '{}',
  hsn_code text,
  gst_rate numeric(4, 2),
  status master_status not null default 'active',
  icon_url text,
  created_at timestamptz not null default now(),
  unique (type, parent_id, name)
);

-- ---------------------------------------------------------------------
-- Addresses
-- ---------------------------------------------------------------------
create table addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  label text not null,
  full_address text not null,
  pincode text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Engine A: RFQs + Quotes
-- ---------------------------------------------------------------------
create table rfqs (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles (id) on delete cascade,
  process_id uuid references master_items (id),
  material_id uuid references master_items (id),
  quantity integer not null check (quantity > 0),
  tolerance text,
  surface_finish text,
  colour_coating text,
  lead_time_pref text,
  delivery_address_id uuid references addresses (id),
  special_instructions text,
  cad_file_urls text[] default '{}',
  status rfq_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references rfqs (id) on delete cascade,
  vendor_id uuid not null references vendor_profiles (id) on delete cascade,
  unit_price numeric(12, 2) not null check (unit_price > 0),
  total_price numeric(12, 2) not null,
  lead_time_days integer not null check (lead_time_days >= 1),
  material_confirmed_id uuid references master_items (id),
  validity_date date not null,
  notes text,
  attachment_urls text[] default '{}',
  status quote_status not null default 'submitted',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Engine B: Listings (raw materials marketplace)
-- ---------------------------------------------------------------------
create table listings (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendor_profiles (id) on delete cascade,
  title text not null,
  category_id uuid references master_items (id),
  material_id uuid references master_items (id),
  dimensions_spec text,
  unit text not null,
  price_per_unit numeric(12, 2) not null check (price_per_unit > 0),
  min_order_qty numeric(12, 2) not null check (min_order_qty > 0),
  available_stock numeric(12, 2) not null default 0 check (available_stock >= 0),
  low_stock_threshold numeric(12, 2),
  hsn_code text,
  gst_rate numeric(4, 2) not null,
  image_urls text[] default '{}',
  description text,
  status listing_status not null default 'pending_review',
  auto_publish boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Orders (both engines) + line items (marketplace carts split per vendor)
-- ---------------------------------------------------------------------
create sequence if not exists orders_seq start 3001;

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('ORD-' || to_char(nextval('orders_seq'), 'FM10000')),
  buyer_id uuid not null references profiles (id),
  vendor_id uuid not null references vendor_profiles (id),
  order_type order_type not null,
  source_quote_id uuid references quotes (id),
  status order_status not null default 'draft',
  subtotal numeric(12, 2) not null default 0,
  shipping_amount numeric(12, 2) not null default 0,
  gst_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  delivery_address_id uuid references addresses (id),
  billing_gstin text,
  tracking_number text,
  invoice_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  listing_id uuid references listings (id),
  description text not null,
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price numeric(12, 2) not null,
  line_total numeric(12, 2) not null
);

-- ---------------------------------------------------------------------
-- Payments, payouts, reviews, disputes, support, coupons
-- ---------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  amount numeric(12, 2) not null,
  method payment_method not null,
  status payment_status not null default 'pending',
  gateway_ref text,
  created_at timestamptz not null default now()
);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendor_profiles (id) on delete cascade,
  amount numeric(12, 2) not null,
  commission_deducted numeric(12, 2) not null default 0,
  status payout_status not null default 'pending',
  payout_date date,
  created_at timestamptz not null default now()
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  vendor_id uuid not null references vendor_profiles (id) on delete cascade,
  buyer_id uuid not null references profiles (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  vendor_response text,
  created_at timestamptz not null default now()
);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  raised_by uuid not null references profiles (id),
  issue text not null,
  status dispute_status not null default 'open',
  resolution text,
  resolved_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  order_id uuid references orders (id),
  subject text not null,
  message text not null,
  status ticket_status not null default 'open',
  created_at timestamptz not null default now()
);

create table coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type coupon_type not null,
  value numeric(10, 2) not null,
  min_cart_value numeric(12, 2) default 0,
  expiry date,
  usage_cap integer,
  used_count integer not null default 0,
  status master_status not null default 'active'
);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();
create trigger trg_vendor_profiles_updated before update on vendor_profiles
  for each row execute function set_updated_at();
create trigger trg_rfqs_updated before update on rfqs
  for each row execute function set_updated_at();
create trigger trg_listings_updated before update on listings
  for each row execute function set_updated_at();
create trigger trg_orders_updated before update on orders
  for each row execute function set_updated_at();
create trigger trg_disputes_updated before update on disputes
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Auto-create profiles (+ vendor_profiles) row when a new auth user signs
-- up. The app passes role/vendor_type/company_name etc. via
-- `options.data` on supabase.auth.signUp() — see src/app/register/actions.ts.
-- ---------------------------------------------------------------------
create function handle_new_user() returns trigger as $$
declare
  meta jsonb := new.raw_user_meta_data;
  new_role user_role := coalesce((meta ->> 'role')::user_role, 'buyer');
begin
  insert into profiles (id, role, full_name, email, phone)
  values (new.id, new_role, meta ->> 'full_name', new.email, meta ->> 'phone');

  if new_role = 'vendor' then
    insert into vendor_profiles (id, vendor_type, company_name, gstin)
    values (
      new.id,
      coalesce((meta ->> 'vendor_type')::vendor_type, 'fabrication'),
      coalesce(meta ->> 'company_name', ''),
      meta ->> 'gstin'
    );
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- Helper functions for RLS
-- ---------------------------------------------------------------------
create function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

create function is_vendor_owner(v_id uuid) returns boolean as $$
  select v_id = auth.uid();
$$ language sql stable;

-- ---------------------------------------------------------------------
-- Row Level Security
-- v1 policies — deliberately conservative (owner + admin). Refine before
-- production, especially the "vendor can see buyer contact info" boundary.
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table vendor_profiles enable row level security;
alter table staff_roles enable row level security;
alter table master_items enable row level security;
alter table addresses enable row level security;
alter table rfqs enable row level security;
alter table quotes enable row level security;
alter table listings enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table payouts enable row level security;
alter table reviews enable row level security;
alter table disputes enable row level security;
alter table support_tickets enable row level security;
alter table coupons enable row level security;

-- profiles: self + admin
create policy "profiles_select_own_or_admin" on profiles for select
  using (id = auth.uid() or is_admin());
create policy "profiles_update_own" on profiles for update
  using (id = auth.uid());
create policy "profiles_insert_own" on profiles for insert
  with check (id = auth.uid());

-- vendor_profiles: self + admin; buyers can read approved vendors' public fields
-- (kept simple here — split into a public view later if needed)
create policy "vendor_profiles_select_own_or_admin" on vendor_profiles for select
  using (id = auth.uid() or is_admin() or kyc_status = 'approved');
create policy "vendor_profiles_update_own_or_admin" on vendor_profiles for update
  using (id = auth.uid() or is_admin());
create policy "vendor_profiles_insert_own" on vendor_profiles for insert
  with check (id = auth.uid());

create policy "staff_roles_admin_only" on staff_roles for all
  using (is_admin());

-- master_items: readable by everyone (signed in), writable by admin only
create policy "master_items_select_all" on master_items for select
  using (true);
create policy "master_items_admin_write" on master_items for insert
  with check (is_admin());
create policy "master_items_admin_update" on master_items for update
  using (is_admin());
create policy "master_items_admin_delete" on master_items for delete
  using (is_admin());

-- addresses: owner + admin
create policy "addresses_owner_or_admin" on addresses for all
  using (profile_id = auth.uid() or is_admin());

-- rfqs: buyer owner, admin, or a vendor with a quote on it
create policy "rfqs_select" on rfqs for select
  using (
    buyer_id = auth.uid() or is_admin()
    or exists (select 1 from quotes where quotes.rfq_id = rfqs.id and quotes.vendor_id = auth.uid())
  );
create policy "rfqs_insert_own" on rfqs for insert
  with check (buyer_id = auth.uid());
create policy "rfqs_update_own_or_admin" on rfqs for update
  using (buyer_id = auth.uid() or is_admin());

-- quotes: vendor owner, admin, or the buyer who owns the parent RFQ
create policy "quotes_select" on quotes for select
  using (
    vendor_id = auth.uid() or is_admin()
    or exists (select 1 from rfqs where rfqs.id = quotes.rfq_id and rfqs.buyer_id = auth.uid())
  );
create policy "quotes_insert_own_vendor" on quotes for insert
  with check (vendor_id = auth.uid());
create policy "quotes_update_own_or_admin" on quotes for update
  using (vendor_id = auth.uid() or is_admin());

-- listings: public read for active listings; vendor manages own; admin all
create policy "listings_select_active_or_own_or_admin" on listings for select
  using (status = 'active' or vendor_id = auth.uid() or is_admin());
create policy "listings_insert_own_vendor" on listings for insert
  with check (vendor_id = auth.uid());
create policy "listings_update_own_or_admin" on listings for update
  using (vendor_id = auth.uid() or is_admin());

-- orders: buyer, vendor on the order, or admin
create policy "orders_select" on orders for select
  using (buyer_id = auth.uid() or vendor_id = auth.uid() or is_admin());
create policy "orders_insert_own_buyer" on orders for insert
  with check (buyer_id = auth.uid());
create policy "orders_update_participant_or_admin" on orders for update
  using (buyer_id = auth.uid() or vendor_id = auth.uid() or is_admin());

create policy "order_items_via_order" on order_items for select
  using (exists (
    select 1 from orders
    where orders.id = order_items.order_id
      and (orders.buyer_id = auth.uid() or orders.vendor_id = auth.uid() or is_admin())
  ));

create policy "payments_via_order" on payments for select
  using (exists (
    select 1 from orders
    where orders.id = payments.order_id
      and (orders.buyer_id = auth.uid() or orders.vendor_id = auth.uid() or is_admin())
  ));

create policy "payouts_owner_or_admin" on payouts for select
  using (vendor_id = auth.uid() or is_admin());

create policy "reviews_select_all" on reviews for select using (true);
create policy "reviews_insert_own_buyer" on reviews for insert
  with check (buyer_id = auth.uid());

create policy "disputes_participant_or_admin" on disputes for select
  using (
    raised_by = auth.uid() or is_admin()
    or exists (
      select 1 from orders
      where orders.id = disputes.order_id
        and (orders.buyer_id = auth.uid() or orders.vendor_id = auth.uid())
    )
  );
create policy "disputes_insert_participant" on disputes for insert
  with check (raised_by = auth.uid());
create policy "disputes_update_admin" on disputes for update
  using (is_admin());

create policy "support_tickets_owner_or_admin" on support_tickets for all
  using (profile_id = auth.uid() or is_admin());

create policy "coupons_select_active" on coupons for select
  using (status = 'active' or is_admin());
create policy "coupons_admin_write" on coupons for insert with check (is_admin());
create policy "coupons_admin_update" on coupons for update using (is_admin());
