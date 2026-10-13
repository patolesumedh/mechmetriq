-- =====================================================================
-- MECHmetrIQ — Vendor onboarding: business profile, contact & operations,
-- capability and additional documents (onboarding journey steps 2–5).
--
-- vendor_details  : business profile + facility/operations + capability.
--                   Vendor + admin only (vendor_profiles is readable by anyone
--                   for approved vendors, so new business data stays off it).
-- vendor_kyc      : + Udyam number, address line 2 / city / state, primary
--                   contact person, and a map of extra document uploads.
--
-- Additive only: safe to apply while the current app version is live.
-- =====================================================================

create table if not exists public.vendor_details (
  vendor_id uuid primary key references public.vendor_profiles (id) on delete cascade,
  -- Business profile
  trade_name text,
  year_established smallint check (year_established between 1900 and 2100),
  website text,
  business_email text,
  -- Facility & operations
  facility_locations text,
  facility_count smallint check (facility_count >= 0),
  facility_area_sqft integer check (facility_area_sqft >= 0),
  employee_count integer check (employee_count >= 0),
  working_hours text,
  production_capacity text,
  serviceable_geography text,
  -- Fabrication capability
  machines text,
  max_job_size text,
  tolerance_capability text,
  industries text[] not null default '{}',
  inspection_capability text[] not null default '{}',
  -- Raw-material supplier details (grades/sizes live in rm_vendor_supply)
  brands text,
  stock_locations text,
  supply_capacity text,
  delivery_locations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_vendor_details_updated before update on public.vendor_details
  for each row execute function public.set_updated_at();

alter table public.vendor_details enable row level security;
revoke all on public.vendor_details from anon;

create policy "vendor_details_select_own_or_admin" on public.vendor_details for select
  to authenticated
  using (vendor_id = (select auth.uid()) or (select is_admin()));
create policy "vendor_details_insert_own" on public.vendor_details for insert
  to authenticated
  with check (vendor_id = (select auth.uid()) or (select is_admin()));
create policy "vendor_details_update_own_or_admin" on public.vendor_details for update
  to authenticated
  using (vendor_id = (select auth.uid()) or (select is_admin()))
  with check (vendor_id = (select auth.uid()) or (select is_admin()));
create policy "vendor_details_delete_admin" on public.vendor_details for delete
  to authenticated
  using ((select is_admin()));

alter table public.vendor_kyc
  add column if not exists udyam_number text,
  add column if not exists address_line2 text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists contact_name text,
  add column if not exists contact_designation text,
  add column if not exists contact_mobile text,
  add column if not exists contact_email text,
  -- { "<kind>": ["<vendor_id>/<file>", ...] }, kinds whitelisted in the app
  add column if not exists documents jsonb not null default '{}'::jsonb;
