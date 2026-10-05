-- Adds buyer-facing billing/GST fields to profiles, backing the Profile
-- page's new mandatory Organization Name / GST Registered / GSTIN /
-- Billing Address fields (see claude/buyer-dashboard-changes.md item 2).
-- Nullable at the DB level so existing buyers aren't broken retroactively;
-- "required" is enforced in the Profile form and server action going
-- forward. GST dependency (org name + GSTIN required once registered) and
-- format checks are enforced at the DB level too via CHECK constraints.

alter table public.profiles
  add column if not exists organization_name text,
  add column if not exists gst_registered boolean not null default false,
  add column if not exists gstin text,
  add column if not exists billing_address text,
  add column if not exists billing_pincode text;

alter table public.profiles
  add constraint profiles_gstin_format_chk
    check (gstin is null or gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$');

alter table public.profiles
  add constraint profiles_billing_pincode_format_chk
    check (billing_pincode is null or billing_pincode ~ '^[1-9][0-9]{5}$');

alter table public.profiles
  add constraint profiles_gst_requires_org_and_gstin_chk
    check (gst_registered = false or (organization_name is not null and gstin is not null));

comment on column public.profiles.organization_name is 'Buyer''s registered business/organization name. Required when gst_registered is true.';
comment on column public.profiles.gst_registered is 'Whether the buyer has a GST registration on file.';
comment on column public.profiles.gstin is 'Buyer''s GSTIN, required and format-checked when gst_registered is true.';
comment on column public.profiles.billing_address is 'Buyer''s single registered/billing address, separate from the multiple delivery addresses in the addresses table.';
comment on column public.profiles.billing_pincode is 'Pincode for billing_address.';
