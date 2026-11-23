-- =====================================================================
-- MECHmetrIQ — Storage buckets for CAD/drawing attachments and listing images
-- =====================================================================

-- CAD/drawing attachments for RFQs, uploaded from the "Get Instant Quote" form.
-- Path convention: {buyer_user_id}/{filename} — enforced by the insert policy below.
insert into storage.buckets (id, name, public)
values ('rfq-attachments', 'rfq-attachments', false)
on conflict (id) do nothing;

-- Buyers can upload into their own folder.
create policy "rfq_attachments_insert_own_folder" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'rfq-attachments'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Buyers can manage (update/delete) their own files.
create policy "rfq_attachments_update_own_folder" on storage.objects
  for update
  to authenticated
  using (bucket_id = 'rfq-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "rfq_attachments_delete_own_folder" on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'rfq-attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Read access: the owning buyer, any vendor who has quoted (or can quote) on that
-- buyer's RFQs, or an admin. Since the bucket is private, reads happen via signed URLs,
-- but we still scope who is *allowed* to request one.
create policy "rfq_attachments_select_buyer_vendor_admin" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'rfq-attachments'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or is_admin()
      or exists (
        select 1 from rfqs
        where rfqs.buyer_id::text = (storage.foldername(name))[1]
          and exists (select 1 from vendor_profiles vp where vp.id = (select auth.uid()))
      )
    )
  );

-- Product/listing images for the raw materials marketplace — public read (they're
-- meant to be browsed on the marketplace), writes restricted to the owning vendor.
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

create policy "listing_images_public_read" on storage.objects
  for select
  using (bucket_id = 'listing-images');

create policy "listing_images_insert_own_folder" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "listing_images_update_own_folder" on storage.objects
  for update
  to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "listing_images_delete_own_folder" on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
