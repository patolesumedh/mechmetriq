-- =====================================================================
-- MECHmetrIQ — RLS fixes discovered while wiring up the buyer dashboard
-- =====================================================================

-- Buyers (and vendors/admin) need to be able to insert order_items for
-- orders they own — the original schema enabled RLS on order_items but
-- never added an INSERT policy, which silently blocked checkout and
-- quote-acceptance flows.
create policy order_items_insert_own_order on order_items
  for insert
  with check (
    exists (
      select 1 from orders
      where orders.id = order_items.order_id
        and (orders.buyer_id = (select auth.uid()) or orders.vendor_id = (select auth.uid()) or is_admin())
    )
  );

-- Buyers need to be able to flip a quote's status when accepting/declining
-- it on their own RFQ, not just the vendor who submitted it. The original
-- policy only allowed the owning vendor (or admin) to update a quote.
drop policy if exists quotes_update_own_or_admin on quotes;
create policy quotes_update_own_or_admin on quotes
  for update
  using (
    vendor_id = (select auth.uid())
    or is_admin()
    or exists (select 1 from rfqs where rfqs.id = quotes.rfq_id and rfqs.buyer_id = (select auth.uid()))
  )
  with check (
    vendor_id = (select auth.uid())
    or is_admin()
    or exists (select 1 from rfqs where rfqs.id = quotes.rfq_id and rfqs.buyer_id = (select auth.uid()))
  );
