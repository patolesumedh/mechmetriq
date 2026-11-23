-- =====================================================================
-- MECHmetriQ — fix infinite recursion between rfqs and quotes RLS
-- =====================================================================
-- rfqs_select checked quotes, and quotes_select/update checked rfqs, so
-- Postgres aborted every buyer/vendor read of either table with
-- "infinite recursion detected in policy for relation rfqs" (My Quotes
-- showed empty lists; RFQ insert ... returning failed).
-- Same access rules as before; the cross-table checks now go through
-- SECURITY DEFINER helpers that only answer about the calling user.
-- Applied to production 30 Sep 2026 (two migrations, consolidated here).
-- =====================================================================

create or replace function public.vendor_has_quote_on(p_rfq_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$ select exists (select 1 from quotes where rfq_id = p_rfq_id and vendor_id = auth.uid()) $$;

create or replace function public.rfq_is_mine(p_rfq_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$ select exists (select 1 from rfqs where id = p_rfq_id and buyer_id = auth.uid()) $$;

grant execute on function public.vendor_has_quote_on(uuid) to anon, authenticated;
grant execute on function public.rfq_is_mine(uuid) to anon, authenticated;

drop policy if exists "rfqs_select" on rfqs;
create policy "rfqs_select" on rfqs for select
  using (buyer_id = (select auth.uid()) or (select is_admin()) or vendor_has_quote_on(id));

drop policy if exists "quotes_select" on quotes;
create policy "quotes_select" on quotes for select
  using (vendor_id = (select auth.uid()) or (select is_admin()) or rfq_is_mine(rfq_id));

drop policy if exists "quotes_update_own_or_admin" on quotes;
create policy "quotes_update_own_or_admin" on quotes for update
  using (vendor_id = (select auth.uid()) or (select is_admin()) or rfq_is_mine(rfq_id))
  with check (vendor_id = (select auth.uid()) or (select is_admin()) or rfq_is_mine(rfq_id));
