# MECHmetriQ Vendor Portal — Change List

Model: vendors are contracted; the platform sets the price and assigns orders to them. Vendors do not bid.

## 1. My Quotes page
- Park it as "Coming soon": keep it in the nav, show a coming-soon state instead of the quotes list.

## 2. Onboarding / KYC page — PII protection (DPDP Act, India)
All details on this page are personal or sensitive data and must be protected.
- **Encryption:** HTTPS everywhere; encrypt PAN, GSTIN, bank account number and IFSC at rest, at field level.
- **Masking:** after saving, show only the last 4 characters (e.g. XXXXXX1234). Full values are never sent back to the browser.
- **Access control:** only the vendor's own account and named internal roles (onboarding/finance admin) can read the data. Enforce this at the database level (row-level security), not only in the UI.
- **Audit log:** record who viewed, changed or downloaded KYC data, and when.
- **Consent:** before "Submit for Approval", show a short notice saying what is collected, why (verification, GST invoicing, payouts), how long it is kept, and who to contact. Require an explicit consent checkbox (not pre-ticked), and store the consent with a timestamp.
- **Purpose limitation and minimisation:** use this data only for verification, invoicing and payouts; collect nothing extra.
- **Vendor rights:** the vendor can view and correct their data and request deletion (subject to tax/legal retention). Show a grievance contact.
- **Retention:** define a retention period and delete or anonymise data after the vendor relationship ends plus the legal retention period.
- **No leakage:** keep PII out of URLs, application logs, error messages and analytics tools.
- **Validation:** validate PAN, GSTIN, IFSC, pincode and account number formats on the server as well as the client.
- **Breach process:** document who is informed and how if the data is exposed.

## 3. Onboarding / KYC page — document uploads
- **Replace the "Cancelled cheque / bank doc URL" field with a file upload** that takes a photo or scan of a cancelled cheque or bank passbook page.
  - Accept JPG, PNG and PDF; set a maximum size (e.g. 5 MB); allow a camera capture on mobile.
  - Show a preview and allow replace or remove before submission.
  - Store files in private storage only; never make them public. Admins view them through short-lived signed links.
- **Apply the same upload to "Certifications URL"** (optional; allow multiple files).
- **Add "Account holder name"** so the bank details can be checked against the business name.

## 4. Onboarding / KYC page — wording to match the contracted-vendor model
- Top banner: "Complete your KYC to start receiving RFQs and quoting jobs" → "Complete your KYC to start receiving orders."
- Capabilities help text: "this drives which RFQs you receive" → "this decides which orders are assigned to you."
- "Materials you can machine" → "Materials you work with" (casting, moulding and 3D printing aren't machining).

---
## Status — 24 Sep 2026 (PR #1 merged to main; live on mechmetriq.vercel.app)
Built: sections 1–4, for both fabrication and raw-material vendors.

**Security fixes found while building**
- Approved vendors' PAN, bank account and IFSC were readable by anyone (even logged-out) through the database API. Fixed by moving them into `vendor_kyc` (vendor + admin only).
- Vendors could set their own KYC to "approved" or change commission/rating. Fixed with a database guard.

**Deviations / decisions**
- GSTIN stays readable (it's public by law and printed on invoices); PAN, bank account and IFSC are encrypted.
- "Internal roles" = admin only for now; a finance/onboarding role needs `staff_roles` wiring.
- Grievance contact uses hello@mechmetriq.com — confirm or replace (`PRIVACY_CONTACT_EMAIL` in `src/lib/kyc/rules.ts`).
- Retention wording: "while active + as long as tax/accounting law requires". Fix an exact period with legal.
- Submit for Approval now requires PAN, address, bank details, holder name and cheque/passbook image; otherwise it saves as draft and lists what's missing.

**Database**
- Step 1 (`0006_vendor_kyc_privacy`) applied to Supabase `mechmetriq` on 24 Sep; RLS tested.
- Step 2 (`0007_drop_plaintext_kyc_columns`) — code is live; apply once the live KYC flow has been tested (keeping the columns until then allows reverting PR #1).
- `KYC_ENCRYPTION_KEY` added in Vercel (Production + Preview). Must never be lost or changed.

**Still open (not code)**
- Breach-response process (who is told, within what time).
- Legal review of the consent notice and retention period.
- Pre-existing: `internal_notes` / `commission_override` on vendor_profiles are still readable for approved vendors; Supabase leaked-password protection is off.
