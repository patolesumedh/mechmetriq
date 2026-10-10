-- =====================================================================
-- 0015 · Custom-part vendor assignment + order write lockdown
-- =====================================================================
-- 1. order_vendor_assignments — who makes a custom-part order and what
--    they are paid. Kept off the orders row so buyers never see the
--    vendor payout / platform margin (orders is readable by the buyer).
-- 2. cp_eligible_vendors()  — admin: KYC-approved fabrication vendors,
--    flagged by whether they declared the RFQ's process and material.
-- 3. cp_assign_vendor()     — admin: assign / reassign the machining
--    vendor on a paid custom-part order (until production starts).
-- 4. Security: orders and order_items can no longer be written directly
--    by buyers for ANY order type. Previously custom-part orders were
--    only covered by RLS, which let a buyer insert an "accepted_paid"
--    order without paying, or edit status / amounts / vendor on their
--    own order. Orders are now created only by the checkout RPCs
--    (sq_pay_quote, rm_place_order — both SECURITY DEFINER), and the
--    assigned vendor may only advance fulfilment status + tracking.
-- =====================================================================

-- 1 -------------------------------------------------------------------
create table if not exists public.order_vendor_assignments (
  order_id        uuid primary key references public.orders (id) on delete cascade,
  vendor_id       uuid not null references public.vendor_profiles (id),
  vendor_payout   numeric(12, 2) not null check (vendor_payout >= 0),
  commission_pct  numeric(5, 2),
  note            text,
  assigned_at     timestamptz not null default now(),
  assigned_by     uuid references public.profiles (id)
);
create index if not exists order_vendor_assignments_vendor_idx
  on public.order_vendor_assignments (vendor_id);

alter table public.order_vendor_assignments enable row level security;

drop policy if exists ova_select on public.order_vendor_assignments;
create policy ova_select on public.order_vendor_assignments for select
  using (vendor_id = (select auth.uid()) or (select is_admin()));
-- No insert/update/delete policies: writes go through cp_assign_vendor().

-- 2 -------------------------------------------------------------------
create or replace function public.cp_eligible_vendors(p_order_id uuid)
returns table (
  vendor_id           uuid,
  company_name        text,
  process_match       boolean,
  material_match      boolean,
  typical_lead_time   text,
  commission_override numeric,
  rating              numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_process  text;
  v_material text;
begin
  if not is_admin() then
    raise exception 'Only admins can assign vendors' using errcode = '42501';
  end if;

  select mp.name,
         coalesce(rm.name, mm.name)
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
   where vp.vendor_type = 'fabrication'
     and vp.kyc_status = 'approved'
   order by 3 desc, 4 desc, vp.rating desc nulls last, vp.company_name;
end;
$$;

-- 3 -------------------------------------------------------------------
create or replace function public.cp_assign_vendor(
  p_order_id  uuid,
  p_vendor_id uuid,
  p_payout    numeric,
  p_note      text default null
)
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
  if not found or v.vendor_type <> 'fabrication' then
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

revoke all on function public.cp_eligible_vendors(uuid) from public, anon;
revoke all on function public.cp_assign_vendor(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.cp_eligible_vendors(uuid) to authenticated;
grant execute on function public.cp_assign_vendor(uuid, uuid, numeric, text) to authenticated;

-- 4 -------------------------------------------------------------------
-- One guard for every order type (replaces the raw-material-only rules).
create or replace function public.rm_guard_orders()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Admins and SECURITY DEFINER platform functions (checkout, approval,
  -- assignment) run as the function owner and pass straight through.
  if current_user not in ('authenticated', 'anon') or is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.order_type = 'raw_material' then
      raise exception 'Raw material orders must be placed from the cart';
    end if;
    raise exception 'Orders can only be placed through checkout';
  end if;

  if new.order_type is distinct from old.order_type then
    raise exception 'order_type cannot be changed';
  end if;

  -- Only the assigned vendor may touch an order, and only to advance
  -- fulfilment and add tracking. Buyers have no direct write access.
  if old.vendor_id is null or old.vendor_id <> auth.uid() then
    raise exception 'Orders can only be changed through the platform';
  end if;

  if (new.status is distinct from old.status and not (
        (old.status = 'accepted_paid' and new.status = 'in_production')
     or (old.status = 'in_production' and new.status in ('qc_ready', 'shipped'))
     or (old.status = 'qc_ready' and new.status = 'shipped')
     or (old.status = 'shipped' and new.status = 'delivered')))
     or (row(new.id, new.order_number, new.buyer_id, new.vendor_id, new.order_type,
             new.source_quote_id, new.source_rfq_id, new.subtotal, new.shipping_amount,
             new.gst_amount, new.total_amount, new.delivery_address_id, new.billing_gstin,
             new.invoice_url, new.created_at, new.rm_total_weight_kg, new.rm_material_value,
             new.rm_bulk_discount, new.rm_cut_charges, new.rm_mtc_charges, new.rm_admin_note,
             new.rm_approved_at, new.rm_approved_by, new.rm_paid_at)
         is distinct from
         row(old.id, old.order_number, old.buyer_id, old.vendor_id, old.order_type,
             old.source_quote_id, old.source_rfq_id, old.subtotal, old.shipping_amount,
             old.gst_amount, old.total_amount, old.delivery_address_id, old.billing_gstin,
             old.invoice_url, old.created_at, old.rm_total_weight_kg, old.rm_material_value,
             old.rm_bulk_discount, old.rm_cut_charges, old.rm_mtc_charges, old.rm_admin_note,
             old.rm_approved_at, old.rm_approved_by, old.rm_paid_at)) then
    raise exception 'Vendors can only advance fulfilment status and add tracking';
  end if;
  return new;
end;
$$;

-- Order lines: written only by checkout RPCs / admins, for every order type.
create or replace function public.rm_guard_order_items()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or is_admin() then
    return coalesce(new, old);
  end if;
  raise exception 'Order lines cannot be changed directly';
end;
$$;

-- Defence in depth: drop the client write policies that the guards now
-- make unusable anyway.
drop policy if exists orders_insert_own_buyer on public.orders;
drop policy if exists order_items_insert_own_order on public.order_items;
drop policy if exists orders_update_participant_or_admin on public.orders;
create policy orders_update_vendor_or_admin on public.orders for update
  using (vendor_id = (select auth.uid()) or (select is_admin()));

-- 5 -------------------------------------------------------------------
-- The assigned vendor needs the job spec (process, grade, tolerance,
-- finish, CAD files) to machine the part. Let them read the RFQ behind
-- an order assigned to them. SECURITY DEFINER helper avoids RLS
-- recursion between rfqs and orders.
create or replace function public.vendor_assigned_rfq(p_rfq_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from orders
     where source_rfq_id = p_rfq_id
       and vendor_id = (select auth.uid())
  );
$$;
revoke all on function public.vendor_assigned_rfq(uuid) from public, anon;
grant execute on function public.vendor_assigned_rfq(uuid) to authenticated;

drop policy if exists rfqs_select on public.rfqs;
create policy rfqs_select on public.rfqs for select
  using (
    buyer_id = (select auth.uid())
    or (select is_admin())
    or vendor_has_quote_on(id)
    or vendor_assigned_rfq(id)
  );
