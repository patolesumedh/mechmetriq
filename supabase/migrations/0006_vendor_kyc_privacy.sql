-- =====================================================================
-- MECHmetrIQ — Vendor KYC privacy (DPDP Act 2023)
--
-- 1. vendor_kyc: sensitive KYC data moved out of vendor_profiles into its
--    own table readable only by the vendor and admins. PAN, bank account
--    number and IFSC are stored encrypted (AES-256-GCM, key held only by the
--    app server in KYC_ENCRYPTION_KEY) plus a last-4 value for masked display.
-- 2. kyc_audit_log: who viewed / changed KYC data and when (admin-read only).
-- 3. vendor-kyc-docs: private storage bucket for cancelled cheque / passbook
--    images and certificates, 5 MB max, JPG/PNG/PDF only.
-- 4. Guard trigger: vendors can no longer change their own kyc_status to
--    anything but "pending", nor commission / rating / admin notes.
--
-- Additive only: safe to apply while the previous app version is live.
-- The old plaintext columns are dropped in 0007 once the new app is deployed.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Private KYC table
-- ---------------------------------------------------------------------
create table if not exists public.vendor_kyc (
  vendor_id uuid primary key references public.vendor_profiles (id) on delete cascade,
  pan_enc text,
  pan_last4 text,
  registered_address text,
  account_holder_name text,
  bank_account_enc text,
  bank_account_last4 text,
  ifsc_enc text,
  ifsc_last4 text,
  cancelled_cheque_path text,          -- object path in vendor-kyc-docs
  certification_paths text[] not null default '{}',
  consent_at timestamptz,
  consent_version text,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_vendor_kyc_updated before update on public.vendor_kyc
  for each row execute function public.set_updated_at();

alter table public.vendor_kyc enable row level security;
revoke all on public.vendor_kyc from anon;

create policy "vendor_kyc_select_own_or_admin" on public.vendor_kyc for select
  to authenticated
  using (vendor_id = (select auth.uid()) or (select is_admin()));
create policy "vendor_kyc_insert_own" on public.vendor_kyc for insert
  to authenticated
  with check (vendor_id = (select auth.uid()));
create policy "vendor_kyc_update_own_or_admin" on public.vendor_kyc for update
  to authenticated
  using (vendor_id = (select auth.uid()) or (select is_admin()))
  with check (vendor_id = (select auth.uid()) or (select is_admin()));
create policy "vendor_kyc_delete_admin" on public.vendor_kyc for delete
  to authenticated
  using ((select is_admin()));

-- ---------------------------------------------------------------------
-- 2. Audit log (append-only; written through log_kyc_event only)
-- ---------------------------------------------------------------------
create table if not exists public.kyc_audit_log (
  id bigint generated always as identity primary key,
  vendor_id uuid not null references public.vendor_profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('view', 'update', 'submit', 'document_view', 'deletion_request', 'consent')),
  fields text[] not null default '{}',   -- field NAMES only, never values
  created_at timestamptz not null default now()
);
create index if not exists kyc_audit_log_vendor_idx on public.kyc_audit_log (vendor_id, created_at desc);
create index if not exists kyc_audit_log_actor_idx on public.kyc_audit_log (actor_id);

alter table public.kyc_audit_log enable row level security;
revoke all on public.kyc_audit_log from anon;

create policy "kyc_audit_log_select_admin" on public.kyc_audit_log for select
  to authenticated
  using ((select is_admin()));

create or replace function public.log_kyc_event(p_vendor_id uuid, p_action text, p_fields text[] default '{}')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_vendor_id <> auth.uid() and not is_admin() then
    raise exception 'not allowed';
  end if;
  insert into kyc_audit_log (vendor_id, actor_id, action, fields)
  values (p_vendor_id, auth.uid(), p_action, coalesce(p_fields, '{}'));
end;
$$;
revoke execute on function public.log_kyc_event(uuid, text, text[]) from public, anon;
grant execute on function public.log_kyc_event(uuid, text, text[]) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Private bucket for KYC documents. Path: {vendor_id}/{file}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vendor-kyc-docs', 'vendor-kyc-docs', false, 5242880,
        array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "vendor_kyc_docs_insert_own" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'vendor-kyc-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "vendor_kyc_docs_select_own_or_admin" on storage.objects for select
  to authenticated
  using (bucket_id = 'vendor-kyc-docs'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select is_admin())));
create policy "vendor_kyc_docs_update_own" on storage.objects for update
  to authenticated
  using (bucket_id = 'vendor-kyc-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "vendor_kyc_docs_delete_own_or_admin" on storage.objects for delete
  to authenticated
  using (bucket_id = 'vendor-kyc-docs'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select is_admin())));

-- ---------------------------------------------------------------------
-- 4. Vendors cannot approve themselves or edit admin-owned fields
-- ---------------------------------------------------------------------
create or replace function public.guard_vendor_profile_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Admins and server-side service calls (no end-user JWT) are unrestricted.
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  if new.kyc_status is distinct from old.kyc_status
     and not (new.kyc_status = 'pending' and old.kyc_status in ('draft', 'rejected')) then
    raise exception 'kyc_status can only be changed by an admin';
  end if;

  if new.vendor_type is distinct from old.vendor_type
     or new.commission_override is distinct from old.commission_override
     or new.internal_notes is distinct from old.internal_notes
     or new.rating is distinct from old.rating
     or new.category_permissions is distinct from old.category_permissions
     or new.kyc_rejection_reason is distinct from old.kyc_rejection_reason then
    raise exception 'these fields can only be changed by an admin';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_vendor_profile_update on public.vendor_profiles;
create trigger trg_guard_vendor_profile_update before update on public.vendor_profiles
  for each row execute function public.guard_vendor_profile_update();
