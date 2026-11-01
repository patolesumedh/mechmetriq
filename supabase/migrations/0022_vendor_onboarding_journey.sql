-- =====================================================================
-- MECHmetrIQ — E5 Vendor onboarding (part 2 of 2): finish the journey.
--
-- F5.1  Review & submit: application ID, declarations, submit through
--       vendor_submit_kyc() only.
-- F5.2  Duplicate-vendor check: same GSTIN, or same PAN (keyed hash, since
--       PAN is stored encrypted), flagged for admins.
-- F5.3  Statuses Submitted (pending) → Under review → Correction required /
--       Approved / Rejected, and Suspended; only approved vendors can work
--       orders, quotes, listings and supply (enforced here, not only in UI).
-- F5.4  Per-section correction remarks + full review history.
-- F5.5  Admin vendor invites: single-use, expiring, resendable, revocable.
-- F5.6  vendor_type 'both': matching and assignment accept it.
--
-- Additive for the live app, with one behaviour change: vendors can no
-- longer move their own KYC from draft to pending with a plain update —
-- the current app does that on save, so deploy the matching app version
-- together with this migration.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------
create sequence if not exists public.vendor_application_seq start 1;

alter table public.vendor_profiles
  add column if not exists application_id text unique,
  add column if not exists submitted_at timestamptz,
  add column if not exists declarations_accepted_at timestamptz,
  add column if not exists declarations_version text,
  add column if not exists kyc_status_reason text,
  add column if not exists kyc_reviewed_at timestamptz,
  add column if not exists kyc_reviewed_by uuid references public.profiles (id) on delete set null;

alter table public.vendor_kyc
  add column if not exists pan_hash text,
  add column if not exists gstin_pan_hash text;
create index if not exists vendor_kyc_pan_hash_idx on public.vendor_kyc (pan_hash) where pan_hash is not null;
create index if not exists vendor_kyc_gstin_pan_hash_idx on public.vendor_kyc (gstin_pan_hash) where gstin_pan_hash is not null;
create index if not exists vendor_profiles_gstin_idx on public.vendor_profiles (upper(gstin)) where gstin is not null;

-- ---------------------------------------------------------------------
-- 2. Review history (F5.3 / F5.4)
-- ---------------------------------------------------------------------
create table if not exists public.vendor_kyc_reviews (
  id bigint generated always as identity primary key,
  vendor_id uuid not null references public.vendor_profiles (id) on delete cascade,
  action text not null check (action in (
    'submitted', 'review_started', 'correction_requested', 'approved',
    'rejected', 'suspended', 'reactivated', 'type_changed')),
  from_status public.kyc_status,
  to_status public.kyc_status,
  reason text,
  remarks jsonb not null default '{}'::jsonb,   -- { "<section>": "<what to fix>" }
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists vendor_kyc_reviews_vendor_idx on public.vendor_kyc_reviews (vendor_id, created_at desc);
create index if not exists vendor_kyc_reviews_actor_idx on public.vendor_kyc_reviews (actor_id);
alter table public.vendor_kyc_reviews enable row level security;
revoke all on public.vendor_kyc_reviews from anon;
create policy "vendor_kyc_reviews_select_own_or_admin" on public.vendor_kyc_reviews for select
  to authenticated
  using (vendor_id = (select auth.uid()) or (select is_admin()));
-- Written only by the SECURITY DEFINER functions below.

-- ---------------------------------------------------------------------
-- 3. Duplicate-vendor flags (F5.2)
-- ---------------------------------------------------------------------
create table if not exists public.vendor_duplicate_flags (
  id bigint generated always as identity primary key,
  vendor_id uuid not null references public.vendor_profiles (id) on delete cascade,
  matched_vendor_id uuid not null references public.vendor_profiles (id) on delete cascade,
  field text not null check (field in ('gstin', 'pan')),
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolution_note text,
  unique (vendor_id, matched_vendor_id, field)
);
create index if not exists vendor_duplicate_flags_matched_idx on public.vendor_duplicate_flags (matched_vendor_id);
create index if not exists vendor_duplicate_flags_resolved_by_idx on public.vendor_duplicate_flags (resolved_by);
alter table public.vendor_duplicate_flags enable row level security;
revoke all on public.vendor_duplicate_flags from anon;
create policy "vendor_duplicate_flags_admin_select" on public.vendor_duplicate_flags for select
  to authenticated using ((select is_admin()));
create policy "vendor_duplicate_flags_admin_update" on public.vendor_duplicate_flags for update
  to authenticated using ((select is_admin())) with check ((select is_admin()));

create or replace function public.flag_vendor_duplicates(p_vendor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  my_gstin text;
  my_hashes text[];
begin
  select upper(gstin) into my_gstin from vendor_profiles where id = p_vendor_id;
  select array_remove(array[pan_hash, gstin_pan_hash], null) into my_hashes
    from vendor_kyc where vendor_id = p_vendor_id;

  if my_gstin is not null then
    insert into vendor_duplicate_flags (vendor_id, matched_vendor_id, field)
    select p_vendor_id, v.id, 'gstin'
      from vendor_profiles v
     where v.id <> p_vendor_id and upper(v.gstin) = my_gstin
    on conflict do nothing;
  end if;

  if coalesce(array_length(my_hashes, 1), 0) > 0 then
    insert into vendor_duplicate_flags (vendor_id, matched_vendor_id, field)
    select distinct p_vendor_id, k.vendor_id, 'pan'
      from vendor_kyc k
     where k.vendor_id <> p_vendor_id
       and (k.pan_hash = any (my_hashes) or k.gstin_pan_hash = any (my_hashes))
    on conflict do nothing;
  end if;
end;
$$;
revoke execute on function public.flag_vendor_duplicates(uuid) from public, anon, authenticated;

create or replace function public.trg_flag_vendor_duplicates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Separate statements: plpgsql would fail resolving new.vendor_id on vendor_profiles.
  if tg_table_name = 'vendor_kyc' then
    perform flag_vendor_duplicates(new.vendor_id);
  else
    perform flag_vendor_duplicates(new.id);
  end if;
  return new;
end;
$$;
revoke execute on function public.trg_flag_vendor_duplicates() from public, anon, authenticated;

drop trigger if exists trg_vendor_profiles_dupes on public.vendor_profiles;
create trigger trg_vendor_profiles_dupes after insert or update of gstin on public.vendor_profiles
  for each row execute function public.trg_flag_vendor_duplicates();
drop trigger if exists trg_vendor_kyc_dupes on public.vendor_kyc;
create trigger trg_vendor_kyc_dupes after insert or update of pan_hash, gstin_pan_hash on public.vendor_kyc
  for each row execute function public.trg_flag_vendor_duplicates();

-- Existing vendors with the same GSTIN.
do $$ declare r record; begin
  for r in select id from public.vendor_profiles where gstin is not null loop
    perform public.flag_vendor_duplicates(r.id);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Vendors can't change status / review fields themselves
-- ---------------------------------------------------------------------
create or replace function public.guard_vendor_profile_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  -- Only vendor_submit_kyc() may submit (it sets this flag for its own update).
  if new.kyc_status is distinct from old.kyc_status
     and not (coalesce(current_setting('mmq.kyc_submit', true), '') = 'on'
              and new.kyc_status = 'pending'
              and old.kyc_status in ('draft', 'rejected', 'correction_required')) then
    raise exception 'kyc_status can only be changed by an admin';
  end if;

  if coalesce(current_setting('mmq.kyc_submit', true), '') <> 'on'
     and (new.application_id is distinct from old.application_id
          or new.submitted_at is distinct from old.submitted_at
          or new.declarations_accepted_at is distinct from old.declarations_accepted_at
          or new.declarations_version is distinct from old.declarations_version) then
    raise exception 'these fields are set when you submit your application';
  end if;

  if new.vendor_type is distinct from old.vendor_type
     or new.commission_override is distinct from old.commission_override
     or new.internal_notes is distinct from old.internal_notes
     or new.rating is distinct from old.rating
     or new.category_permissions is distinct from old.category_permissions
     or new.kyc_rejection_reason is distinct from old.kyc_rejection_reason
     or new.kyc_status_reason is distinct from old.kyc_status_reason
     or new.kyc_reviewed_at is distinct from old.kyc_reviewed_at
     or new.kyc_reviewed_by is distinct from old.kyc_reviewed_by then
    raise exception 'these fields can only be changed by an admin';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Submit (F5.1)
-- ---------------------------------------------------------------------
create or replace function public.vendor_submit_kyc(p_declarations_version text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v vendor_profiles;
  k vendor_kyc;
  app_id text;
begin
  select * into v from vendor_profiles where id = auth.uid() for update;
  if not found then
    raise exception 'Vendor profile not found';
  end if;
  if v.kyc_status not in ('draft', 'rejected', 'correction_required') then
    raise exception 'This application has already been submitted';
  end if;
  if coalesce(trim(p_declarations_version), '') = '' then
    raise exception 'Please accept the declarations';
  end if;

  -- Backstop for the app's full completeness check.
  select * into k from vendor_kyc where vendor_id = v.id;
  if not found or k.pan_enc is null or k.bank_account_enc is null or k.ifsc_enc is null
     or k.cancelled_cheque_path is null or k.consent_at is null then
    raise exception 'Your KYC is incomplete';
  end if;

  app_id := coalesce(v.application_id,
    'APP-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-'
           || lpad(nextval('vendor_application_seq')::text, 5, '0'));

  perform set_config('mmq.kyc_submit', 'on', true);
  update vendor_profiles
     set kyc_status = 'pending',
         application_id = app_id,
         submitted_at = now(),
         declarations_accepted_at = now(),
         declarations_version = p_declarations_version
   where id = v.id;
  perform set_config('mmq.kyc_submit', 'off', true);

  insert into vendor_kyc_reviews (vendor_id, action, from_status, to_status, actor_id)
  values (v.id, 'submitted', v.kyc_status, 'pending', auth.uid());

  perform flag_vendor_duplicates(v.id);
  return app_id;
end;
$$;
revoke execute on function public.vendor_submit_kyc(text) from public, anon;
grant execute on function public.vendor_submit_kyc(text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Admin review actions (F5.3 / F5.4)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_kyc_status(
  p_vendor_id uuid,
  p_action text,
  p_reason text default null,
  p_remarks jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v vendor_profiles;
  target kyc_status;
  allowed kyc_status[];
  log_action text;
  clean_remarks jsonb := '{}'::jsonb;
  r record;
  why text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not is_admin() then
    raise exception 'Only admins can review vendors' using errcode = '42501';
  end if;
  select * into v from vendor_profiles where id = p_vendor_id for update;
  if not found then
    raise exception 'Vendor not found';
  end if;

  case p_action
    when 'start_review' then target := 'under_review'; allowed := '{pending}'; log_action := 'review_started';
    when 'request_correction' then target := 'correction_required'; allowed := '{pending,under_review}'; log_action := 'correction_requested';
    when 'approve' then target := 'approved'; allowed := '{pending,under_review}'; log_action := 'approved';
    when 'reject' then target := 'rejected'; allowed := '{pending,under_review,correction_required}'; log_action := 'rejected';
    when 'suspend' then target := 'suspended'; allowed := '{approved}'; log_action := 'suspended';
    when 'reactivate' then target := 'approved'; allowed := '{suspended,on_hold}'; log_action := 'reactivated';
    else raise exception 'Unknown action';
  end case;

  if not (v.kyc_status = any (allowed)) then
    raise exception 'Can''t % a vendor whose KYC is %', replace(p_action, '_', ' '), replace(v.kyc_status::text, '_', ' ');
  end if;

  if p_action in ('reject', 'suspend') and why is null then
    raise exception 'A reason is required';
  end if;

  if p_action = 'request_correction' then
    for r in select key, value from jsonb_each_text(coalesce(p_remarks, '{}'::jsonb)) loop
      if r.key in ('business', 'contact', 'operations', 'capability', 'bank', 'documents')
         and nullif(trim(r.value), '') is not null then
        clean_remarks := clean_remarks || jsonb_build_object(r.key, left(trim(r.value), 1000));
      end if;
    end loop;
    if clean_remarks = '{}'::jsonb then
      raise exception 'Add a remark for at least one section';
    end if;
  end if;

  update vendor_profiles
     set kyc_status = target,
         kyc_status_reason = case when p_action in ('reject', 'suspend') then why else null end,
         kyc_rejection_reason = case when p_action = 'reject' then why
                                     when p_action = 'approve' then null
                                     else kyc_rejection_reason end,
         kyc_reviewed_at = now(),
         kyc_reviewed_by = auth.uid()
   where id = v.id;

  insert into vendor_kyc_reviews (vendor_id, action, from_status, to_status, reason, remarks, actor_id)
  values (v.id, log_action, v.kyc_status, target, why, clean_remarks, auth.uid());
end;
$$;
revoke execute on function public.admin_set_kyc_status(uuid, text, text, jsonb) from public, anon;
grant execute on function public.admin_set_kyc_status(uuid, text, text, jsonb) to authenticated;

create or replace function public.admin_set_vendor_type(p_vendor_id uuid, p_type public.vendor_type)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v vendor_profiles;
begin
  if not is_admin() then
    raise exception 'Only admins can change vendor type' using errcode = '42501';
  end if;
  select * into v from vendor_profiles where id = p_vendor_id for update;
  if not found then
    raise exception 'Vendor not found';
  end if;
  if v.vendor_type = p_type then
    return;
  end if;
  update vendor_profiles set vendor_type = p_type where id = v.id;
  insert into vendor_kyc_reviews (vendor_id, action, from_status, to_status, reason, actor_id)
  values (v.id, 'type_changed', v.kyc_status, v.kyc_status,
          replace(v.vendor_type::text, '_', ' ') || ' → ' || replace(p_type::text, '_', ' '), auth.uid());
end;
$$;
revoke execute on function public.admin_set_vendor_type(uuid, public.vendor_type) from public, anon;
grant execute on function public.admin_set_vendor_type(uuid, public.vendor_type) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Only approved vendors can work (F5.3)
-- ---------------------------------------------------------------------
create or replace function public.is_operational_vendor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from vendor_profiles v
      join profiles p on p.id = v.id
     where v.id = auth.uid()
       and v.kyc_status = 'approved'
       and p.account_status = 'active'
  );
$$;
revoke execute on function public.is_operational_vendor() from public, anon;
grant execute on function public.is_operational_vendor() to authenticated;

drop policy if exists "listings_insert_own_vendor" on public.listings;
create policy "listings_insert_own_vendor" on public.listings for insert
  with check (vendor_id = (select auth.uid()) and (select is_operational_vendor()));
drop policy if exists "listings_update_own_or_admin" on public.listings;
create policy "listings_update_own_or_admin" on public.listings for update
  using ((vendor_id = (select auth.uid()) and (select is_operational_vendor())) or (select is_admin()));

drop policy if exists "rm_vendor_supply_insert" on public.rm_vendor_supply;
create policy "rm_vendor_supply_insert" on public.rm_vendor_supply for insert
  with check (
    vendor_id = (select auth.uid())
    and (select is_operational_vendor())
    and exists (select 1 from public.vendor_profiles v
                 where v.id = (select auth.uid()) and v.vendor_type in ('raw_material', 'both'))
  );
drop policy if exists "rm_vendor_supply_update" on public.rm_vendor_supply;
create policy "rm_vendor_supply_update" on public.rm_vendor_supply for update
  using (vendor_id = (select auth.uid()) and (select is_operational_vendor()))
  with check (vendor_id = (select auth.uid()));
drop policy if exists "rm_vendor_supply_delete" on public.rm_vendor_supply;
create policy "rm_vendor_supply_delete" on public.rm_vendor_supply for delete
  using (vendor_id = (select auth.uid()) and (select is_operational_vendor()));

drop policy if exists "orders_update_vendor_or_admin" on public.orders;
create policy "orders_update_vendor_or_admin" on public.orders for update
  using ((vendor_id = (select auth.uid()) and (select is_operational_vendor())) or (select is_admin()));

drop policy if exists "quotes_insert_own_vendor" on public.quotes;
create policy "quotes_insert_own_vendor" on public.quotes for insert
  with check (vendor_id = (select auth.uid()) and (select is_operational_vendor()));

-- ---------------------------------------------------------------------
-- 8. 'both' vendors in matching and assignment (F5.6)
-- ---------------------------------------------------------------------
create or replace function public.cp_eligible_vendors(p_order_id uuid)
returns table(vendor_id uuid, company_name text, process_match boolean, material_match boolean,
              typical_lead_time text, commission_override numeric, rating numeric)
language plpgsql
stable security definer
set search_path = public
as $$
declare
  v_process  text;
  v_material text;
begin
  if not is_admin() then
    raise exception 'Only admins can assign vendors' using errcode = '42501';
  end if;

  select mp.name, coalesce(rm.name, mm.name)
    into v_process, v_material
    from orders o
    join rfqs r on r.id = o.source_rfq_id
    left join master_items mp on mp.id = r.process_id
    left join master_items mm on mm.id = r.material_id
    left join rm_grades g on g.id = r.rm_grade_id
    left join rm_materials rm on rm.id = g.material_id
   where o.id = p_order_id;

  return query
  select vp.id,
         vp.company_name,
         coalesce(v_process is not null and exists (
           select 1 from unnest(vp.capabilities) c where lower(c) = lower(v_process)
         ), false),
         coalesce(v_material is not null and exists (
           select 1 from unnest(vp.materials_machined) m
            where lower(m) = lower(v_material)
               or lower(v_material) like lower(m) || '%'
         ), false),
         vp.typical_lead_time,
         vp.commission_override,
         vp.rating
    from vendor_profiles vp
   where vp.vendor_type in ('fabrication', 'both')
     and vp.kyc_status = 'approved'
   order by 3 desc, 4 desc, vp.rating desc nulls last, vp.company_name;
end;
$$;

create or replace function public.cp_assign_vendor(
  p_order_id uuid, p_vendor_id uuid, p_payout numeric, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders;
  v public.vendor_profiles;
begin
  if not is_admin() then
    raise exception 'Only admins can assign vendors' using errcode = '42501';
  end if;

  select * into o from orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if o.order_type <> 'custom_part' then
    raise exception 'Only custom-part orders are assigned here';
  end if;
  if o.status <> 'accepted_paid' then
    raise exception 'The vendor can only be changed before production starts (order is %)',
      replace(o.status::text, '_', ' ');
  end if;

  select * into v from vendor_profiles where id = p_vendor_id;
  if not found or v.vendor_type not in ('fabrication', 'both') then
    raise exception 'Choose a fabrication vendor';
  end if;
  if v.kyc_status <> 'approved' then
    raise exception '% is not KYC-approved yet', v.company_name;
  end if;

  if p_payout is null or p_payout <= 0 then
    raise exception 'Enter the vendor payout';
  end if;
  if p_payout > o.subtotal then
    raise exception 'Vendor payout (₹%) cannot exceed the order subtotal (₹%)', p_payout, o.subtotal;
  end if;

  insert into order_vendor_assignments
         (order_id, vendor_id, vendor_payout, commission_pct, note, assigned_at, assigned_by)
  values (o.id, v.id, round(p_payout, 2),
          case when o.subtotal > 0 then round((1 - p_payout / o.subtotal) * 100, 2) end,
          nullif(trim(coalesce(p_note, '')), ''), now(), auth.uid())
  on conflict (order_id) do update
     set vendor_id      = excluded.vendor_id,
         vendor_payout  = excluded.vendor_payout,
         commission_pct = excluded.commission_pct,
         note           = excluded.note,
         assigned_at    = excluded.assigned_at,
         assigned_by    = excluded.assigned_by;

  update orders set vendor_id = v.id where id = o.id;
end;
$$;

create or replace function public.rm_approve_order(
  p_order_id uuid, p_vendor_id uuid, p_freight numeric, p_note text default null)
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
    where v.id = p_vendor_id and v.vendor_type in ('raw_material', 'both') and v.kyc_status = 'approved'
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

create or replace function public.rm_eligible_vendors(p_order_id uuid)
returns table(vendor_id uuid, company_name text, warehouse_pincodes text, lines_covered integer, lines_total integer)
language sql
stable security definer
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
  where is_admin() and v.vendor_type in ('raw_material', 'both') and v.kyc_status = 'approved'
  group by v.id, v.company_name
  order by 4 desc, 2;
$$;

-- ---------------------------------------------------------------------
-- 9. Vendor invites (F5.5)
-- ---------------------------------------------------------------------
create table if not exists public.vendor_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,            -- sha256 of the token in the link
  email text not null,
  vendor_type public.vendor_type not null,
  contact_name text not null,
  company_name text not null,
  phone text,
  gstin text,
  expires_at timestamptz not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),
  send_count integer not null default 1,
  revoked_at timestamptz,
  accepted_at timestamptz,
  accepted_user_id uuid references public.profiles (id) on delete set null
);
create unique index if not exists vendor_invites_open_email_idx on public.vendor_invites (lower(email))
  where revoked_at is null and accepted_at is null;
create index if not exists vendor_invites_created_by_idx on public.vendor_invites (created_by);
create index if not exists vendor_invites_accepted_user_idx on public.vendor_invites (accepted_user_id);
alter table public.vendor_invites enable row level security;
revoke all on public.vendor_invites from anon;
create policy "vendor_invites_admin_select" on public.vendor_invites for select
  to authenticated using ((select is_admin()));
create policy "vendor_invites_admin_insert" on public.vendor_invites for insert
  to authenticated with check ((select is_admin()));
create policy "vendor_invites_admin_update" on public.vendor_invites for update
  to authenticated using ((select is_admin())) with check ((select is_admin()));

create or replace function public.vendor_invite_lookup(p_token text)
returns table(email text, vendor_type public.vendor_type, contact_name text, company_name text,
              phone text, gstin text, expires_at timestamptz, status text)
language sql
stable
security definer
set search_path = public
as $$
  select i.email, i.vendor_type, i.contact_name, i.company_name, i.phone, i.gstin, i.expires_at,
         case when i.accepted_at is not null then 'accepted'
              when i.revoked_at is not null then 'revoked'
              when i.expires_at <= now() then 'expired'
              else 'valid' end
    from vendor_invites i
   where length(coalesce(p_token, '')) between 20 and 200
     and i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;
revoke execute on function public.vendor_invite_lookup(text) from public;
grant execute on function public.vendor_invite_lookup(text) to anon, authenticated;

create or replace function public.vendor_invite_mark_accepted(p_token text, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv vendor_invites;
begin
  select * into inv from vendor_invites
   where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
   for update;
  if not found or inv.revoked_at is not null or inv.accepted_at is not null or inv.expires_at <= now() then
    raise exception 'This invitation is no longer valid';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user_id and lower(u.email) = lower(inv.email)) then
    raise exception 'This invitation is for a different email address';
  end if;
  update vendor_invites set accepted_at = now(), accepted_user_id = p_user_id where id = inv.id;
end;
$$;
revoke execute on function public.vendor_invite_mark_accepted(text, uuid) from public;
grant execute on function public.vendor_invite_mark_accepted(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 10. Sign-up accepts vendor_type 'both' (F5.6)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  inv         public.admin_user_invites;
  by_admin    boolean := false;
  role_text   text := coalesce(meta ->> 'role', 'buyer');
  new_role    user_role;
  mobile      text := public.normalize_in_mobile(meta ->> 'phone');
  gst         text := nullif(upper(trim(coalesce(meta ->> 'gstin', ''))), '');
begin
  if meta ? 'admin_invite_token' then
    select * into inv from admin_user_invites
     where lower(email) = lower(new.email)
       and token::text = meta ->> 'admin_invite_token'
       and used_at is null
       and created_at > now() - interval '1 hour'
     for update;
    if found then
      by_admin := true;
      role_text := inv.role::text;
      update admin_user_invites set used_at = now() where id = inv.id;
    end if;
  end if;

  if role_text not in ('buyer', 'vendor') and not (by_admin and role_text = 'admin') then
    raise exception 'Invalid account type.' using errcode = '22023';
  end if;
  new_role := role_text::user_role;

  if coalesce(trim(meta ->> 'full_name'), '') = '' then
    raise exception 'Full name is required.' using errcode = '22023';
  end if;
  if mobile is null and (not by_admin or nullif(trim(coalesce(meta ->> 'phone', '')), '') is not null) then
    raise exception 'Enter a valid 10-digit Indian mobile number.' using errcode = '22023';
  end if;
  if not by_admin and coalesce(meta ->> 'terms_accepted', 'false') <> 'true' then
    raise exception 'You must agree to the Terms of Service and Privacy Policy.' using errcode = '22023';
  end if;
  if new_role = 'vendor' then
    if coalesce(trim(meta ->> 'company_name'), '') = '' then
      raise exception 'Company name is required for vendor accounts.' using errcode = '22023';
    end if;
    if (gst is null and not by_admin) or (gst is not null and not public.is_valid_gstin(gst)) then
      raise exception 'Enter a valid 15-character GSTIN.' using errcode = '22023';
    end if;
    if coalesce(meta ->> 'vendor_type', '') not in ('fabrication', 'raw_material', 'both') then
      raise exception 'Invalid vendor type.' using errcode = '22023';
    end if;
  end if;

  perform set_config('mmq.trusted_profile_write', 'on', true);

  insert into profiles (id, role, full_name, email, phone, email_verified,
                        terms_accepted_at, verification_required)
  values (new.id, new_role, trim(meta ->> 'full_name'), new.email, mobile,
          new.email_confirmed_at is not null,
          case when by_admin then null else now() end,
          true);

  if new_role = 'vendor' then
    insert into vendor_profiles (id, vendor_type, company_name, gstin)
    values (new.id, (meta ->> 'vendor_type')::vendor_type, trim(meta ->> 'company_name'), gst);
  end if;

  perform set_config('mmq.trusted_profile_write', 'off', true);
  return new;
end;
$$;
