-- =====================================================================
-- MECHmetriQ — Custom-part checkout (Accept & pay a confirmed quote)
-- =====================================================================
-- Closes buyer-flow gap 1: once an admin confirms a Smart Quote price,
-- the buyer can accept it and pay. Payment currently goes through the
-- in-app TEST-MODE gateway (no money moves); the gateway reference it
-- generates is stored on the payment row exactly as a real one would be.
--
-- 1. orders.source_rfq_id links a custom-part order to the RFQ it came
--    from; a partial unique index stops the same quote being ordered twice.
-- 2. sq_pay_quote() validates and records the purchase in one transaction:
--    paid order + line item + successful payment, RFQ → accepted.
--    It runs as the function owner, so it bypasses the price guard and
--    order guards the same way the rm_* functions do.
-- 3. Quote validity is enforced here: 7 days from the price confirmation.
--
-- When a real gateway (e.g. Razorpay) is added, call sq_pay_quote() from
-- the verified gateway callback/webhook instead of straight from the
-- browser flow.
-- =====================================================================

-- 1 ------------------------------------------------------------------
alter table public.orders
  add column if not exists source_rfq_id uuid references public.rfqs (id) on delete set null;

create unique index if not exists orders_source_rfq_id_active_uniq
  on public.orders (source_rfq_id)
  where source_rfq_id is not null and status not in ('cancelled', 'refunded');

comment on column public.orders.source_rfq_id is
  'Smart Quote RFQ this custom-part order was placed from (Accept & pay).';

-- 2 ------------------------------------------------------------------
create or replace function public.sq_pay_quote(
  p_rfq_id              uuid,
  p_delivery_address_id uuid,
  p_method              payment_method,
  p_gateway_ref         text,
  p_billing_gstin       text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r          public.rfqs;
  v_order_id uuid;
  v_subtotal numeric(12, 2);
  v_gst      numeric(12, 2);
  v_total    numeric(12, 2);
  v_gstin    text;
  v_file     text;
  v_process  text;
  v_material text;
  v_desc     text;
begin
  select * into r from rfqs where id = p_rfq_id for update;
  if not found or r.buyer_id is distinct from auth.uid() then
    raise exception 'Quote not found';
  end if;
  if r.status = 'accepted' then
    raise exception 'This quote has already been ordered';
  end if;
  if r.status <> 'quoted' or r.price_status <> 'confirmed' or r.confirmed_total is null then
    raise exception 'This quote is not ready for payment yet';
  end if;
  if r.confirmed_at is not null and r.confirmed_at + interval '7 days' < now() then
    raise exception 'This quote expired on %. Please request a new quote.',
      to_char(r.confirmed_at + interval '7 days', 'DD Mon YYYY');
  end if;

  if p_delivery_address_id is null or not exists (
    select 1 from addresses where id = p_delivery_address_id and profile_id = r.buyer_id
  ) then
    raise exception 'Choose a delivery address';
  end if;

  v_gstin := nullif(upper(trim(coalesce(p_billing_gstin, ''))), '');
  if v_gstin is not null and v_gstin !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then
    raise exception 'Enter a valid GSTIN (e.g. 22AAAAA0000A1Z5), or leave it blank';
  end if;

  if nullif(trim(coalesce(p_gateway_ref, '')), '') is null then
    raise exception 'Missing payment reference';
  end if;

  v_subtotal := r.confirmed_total;
  v_gst      := round(v_subtotal * 0.18, 2);
  v_total    := v_subtotal + v_gst;

  -- Line description: "<file> · <process> · <grade or material>"
  v_file := regexp_replace(
              regexp_replace(coalesce((r.cad_file_urls)[1], ''), '^.*/', ''),
              '^[0-9]{10,}-', '');
  select name into v_process from master_items where id = r.process_id;
  if r.rm_grade_id is not null then
    select name into v_material from rm_grades where id = r.rm_grade_id;
  else
    select name into v_material from master_items where id = r.material_id;
  end if;
  v_desc := coalesce(nullif(concat_ws(' · ', nullif(v_file, ''), v_process, v_material), ''),
                     'Custom manufactured part');

  insert into orders (order_type, buyer_id, vendor_id, source_rfq_id, status,
                      subtotal, shipping_amount, gst_amount, total_amount,
                      delivery_address_id, billing_gstin)
  values ('custom_part', r.buyer_id, null, r.id, 'accepted_paid',
          v_subtotal, 0, v_gst, v_total,
          p_delivery_address_id, v_gstin)
  returning id into v_order_id;

  insert into order_items (order_id, description, quantity, unit_price, line_total)
  values (v_order_id, v_desc, r.quantity,
          coalesce(r.confirmed_unit_price, round(v_subtotal / r.quantity, 2)), v_subtotal);

  insert into payments (order_id, amount, method, status, gateway_ref)
  values (v_order_id, v_total, p_method, 'success', trim(p_gateway_ref));

  update rfqs set status = 'accepted' where id = r.id;

  return v_order_id;
end;
$$;

revoke execute on function public.sq_pay_quote(uuid, uuid, payment_method, text, text) from public, anon;
grant execute on function public.sq_pay_quote(uuid, uuid, payment_method, text, text) to authenticated;
