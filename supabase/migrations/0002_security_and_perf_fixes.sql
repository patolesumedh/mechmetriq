-- =====================================================================
-- MECHmetrIQ — security & performance fixes
-- Applied after running the Supabase security/performance advisors on
-- the freshly-created schema in 0001_init.sql.
-- =====================================================================

-- Pin search_path on all SECURITY DEFINER / trigger functions
-- (fixes function_search_path_mutable advisory warnings)
alter function public.is_vendor_owner(uuid) set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.is_admin() set search_path = public;
alter function public.handle_new_user() set search_path = public;

-- Add covering indexes for foreign keys flagged by the performance advisor
create index if not exists idx_addresses_profile_id on public.addresses(profile_id);
create index if not exists idx_disputes_order_id on public.disputes(order_id);
create index if not exists idx_disputes_raised_by on public.disputes(raised_by);
create index if not exists idx_disputes_resolved_by on public.disputes(resolved_by);
create index if not exists idx_listings_category_id on public.listings(category_id);
create index if not exists idx_listings_material_id on public.listings(material_id);
create index if not exists idx_listings_vendor_id on public.listings(vendor_id);
create index if not exists idx_master_items_parent_id on public.master_items(parent_id);
create index if not exists idx_order_items_listing_id on public.order_items(listing_id);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_orders_buyer_id on public.orders(buyer_id);
create index if not exists idx_orders_delivery_address_id on public.orders(delivery_address_id);
create index if not exists idx_orders_source_quote_id on public.orders(source_quote_id);
create index if not exists idx_orders_vendor_id on public.orders(vendor_id);
create index if not exists idx_payments_order_id on public.payments(order_id);
create index if not exists idx_payouts_vendor_id on public.payouts(vendor_id);
create index if not exists idx_quotes_material_confirmed_id on public.quotes(material_confirmed_id);
create index if not exists idx_quotes_rfq_id on public.quotes(rfq_id);
create index if not exists idx_quotes_vendor_id on public.quotes(vendor_id);
create index if not exists idx_reviews_buyer_id on public.reviews(buyer_id);
create index if not exists idx_reviews_order_id on public.reviews(order_id);
create index if not exists idx_reviews_vendor_id on public.reviews(vendor_id);
create index if not exists idx_rfqs_buyer_id on public.rfqs(buyer_id);
create index if not exists idx_rfqs_delivery_address_id on public.rfqs(delivery_address_id);
create index if not exists idx_rfqs_material_id on public.rfqs(material_id);
create index if not exists idx_rfqs_process_id on public.rfqs(process_id);
create index if not exists idx_staff_roles_profile_id on public.staff_roles(profile_id);
create index if not exists idx_support_tickets_order_id on public.support_tickets(order_id);
create index if not exists idx_support_tickets_profile_id on public.support_tickets(profile_id);
