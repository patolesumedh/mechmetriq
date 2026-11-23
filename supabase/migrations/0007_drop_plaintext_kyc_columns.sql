-- =====================================================================
-- MECHmetrIQ — Drop the old plaintext KYC columns from vendor_profiles.
--
-- Apply ONLY after the app version that uses public.vendor_kyc is live.
-- vendor_profiles is readable by everyone for approved vendors, so PAN,
-- bank details, address and document links must not live on it.
-- (Checked before writing: no vendor had any of these fields filled in.)
-- =====================================================================
alter table public.vendor_profiles
  drop column if exists pan,
  drop column if exists registered_address,
  drop column if exists bank_account_number,
  drop column if exists ifsc_code,
  drop column if exists cancelled_cheque_url,
  drop column if exists certifications_url;
