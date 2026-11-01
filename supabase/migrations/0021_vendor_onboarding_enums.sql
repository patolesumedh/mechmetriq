-- =====================================================================
-- MECHmetrIQ — E5 Vendor onboarding (part 1 of 2): new enum values.
-- Kept separate because a new enum value can't be used in the same
-- transaction that adds it.
-- =====================================================================
alter type public.vendor_type add value if not exists 'both';
alter type public.kyc_status add value if not exists 'under_review';
alter type public.kyc_status add value if not exists 'correction_required';
alter type public.kyc_status add value if not exists 'suspended';
