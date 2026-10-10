-- =====================================================================
-- 0017 · Complete a custom-part order
-- =====================================================================
-- Closes the custom-part order lifecycle:
--   accepted_paid → in_production → qc_ready → shipped (vendor)
--   → completed (buyer: "Order received & complete", or admin)
--
-- 1. New order status `completed` (after `delivered`).
-- 2. orders.completed_at / completed_by / completed_by_role /
--    completion_note record who closed the order and why.
-- 3. cp_complete_order(): the only way to complete an order.
--      * Buyer — own custom-part order, once it is shipped/delivered.
--      * Admin — any custom-part order in production or later; a note is
--        required if the order has not been dispatched yet.
-- 4. Order guard (from 0015) now also freezes the completion columns, so
--    vendors still can only advance fulfilment and add tracking.
-- =====================================================================

-- 1 -------------------------------------------------------------------
alter type public.order_status add value if not exists 'completed' after 'delivered';

-- 2 -------------------------------------------------------------------
alter table public.orders
  add column if not exists completed_at      timestamptz,
  add column if not exists completed_by      uuid references public.profiles (id) on delete set null,
  add column if not exists completed_by_role text check (completed_by_role in ('buyer', 'admin')),
  add column if not exists completion_note   text;

create index if not exists idx_orders_completed_by on public.orders (completed_by);

comment on column public.orders.completed_at is 'When the order was marked complete (buyer received it, or admin closed it).';
comment on column public.orders.completed_by_role is 'Who completed the order: buyer or admin.';

-- 3 -------------------------------------------------------------------
create or replace function public.cp_complete_order(p_order_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o        public.orders;
  v_admin  boolean := is_admin();
  v_note   text := nullif(trim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into o from orders where id = p_order_id for update;
  if not found or (o.buyer_id is distinct from auth.uid() and not v_admin) then
    raise exception 'Order not found';
  end if;
  if o.order_type <> 'custom_part' then
    raise exception 'Only custom-part orders can be completed here';
  end if;
  if o.status::text = 'completed' then
    raise exception 'This order is already complete';
  end if;

  if v_admin and o.buyer_id is distinct from auth.uid() then
    if o.status not in ('in_production', 'qc_ready', 'shipped', 'delivered') then
      raise exception 'An order can be completed once production has started (current status: %)',
        replace(o.status::text, '_', ' ');
    end if;
    if o.status not in ('shipped', 'delivered') and v_note is null then
      raise exception 'Add a note explaining why this order is being completed before dispatch';
    end if;
  else
    if o.status not in ('shipped', 'delivered') then
      raise exception 'You can mark the order received once it has been dispatched';
    end if;
  end if;

  update orders set
    status            = 'completed',
    completed_at      = now(),
    completed_by      = auth.uid(),
    completed_by_role = case when v_admin and o.buyer_id is distinct from auth.uid() then 'admin' else 'buyer' end,
    completion_note   = v_note
  where id = o.id;
end;
$$;

revoke execute on function public.cp_complete_order(uuid, text) from public, anon;
grant execute on function public.cp_complete_order(uuid, text) to authenticated;

-- 4 -------------------------------------------------------------------
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
             new.rm_approved_at, new.rm_approved_by, new.rm_paid_at,
             new.completed_at, new.completed_by, new.completed_by_role, new.completion_note)
         is distinct from
         row(old.id, old.order_number, old.buyer_id, old.vendor_id, old.order_type,
             old.source_quote_id, old.source_rfq_id, old.subtotal, old.shipping_amount,
             old.gst_amount, old.total_amount, old.delivery_address_id, old.billing_gstin,
             old.invoice_url, old.created_at, old.rm_total_weight_kg, old.rm_material_value,
             old.rm_bulk_discount, old.rm_cut_charges, old.rm_mtc_charges, old.rm_admin_note,
             old.rm_approved_at, old.rm_approved_by, old.rm_paid_at,
             old.completed_at, old.completed_by, old.completed_by_role, old.completion_note)) then
    raise exception 'Vendors can only advance fulfilment status and add tracking';
  end if;
  return new;
end;
$$;
