-- =====================================================================
-- MECHmetriQ — Fix "DELETE requires a WHERE clause" on Place order
-- =====================================================================
-- rm_place_order() clears its per-transaction temp table with a bare
-- `delete from _rm_q;`. Requests from the app go through PostgREST, which
-- Supabase runs with the pg_safeupdate extension loaded, so that statement
-- is rejected and the buyer sees "DELETE requires a WHERE clause" when
-- placing a raw-material order. Only that line changes; the function body
-- is otherwise identical to 0008.
-- =====================================================================

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
  -- Supabase runs PostgREST requests with pg_safeupdate, which rejects a
  -- DELETE with no WHERE clause ("DELETE requires a WHERE clause").
  delete from _rm_q where true;
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
