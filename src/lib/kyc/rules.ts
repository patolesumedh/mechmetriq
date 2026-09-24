/**
 * KYC validation rules and privacy constants. Shared by the client forms
 * (instant feedback) and the server actions (the check that actually counts).
 */

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const PINCODE_RE = /^[1-9][0-9]{5}$/;
export const ACCOUNT_RE = /^[0-9]{9,18}$/;

export const KYC_DOCS_BUCKET = "vendor-kyc-docs";
export const KYC_DOC_MAX_BYTES = 5 * 1024 * 1024;
export const KYC_DOC_TYPES = ["image/jpeg", "image/png", "application/pdf"];
export const KYC_DOC_ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";
export const MAX_CERTIFICATIONS = 5;

/** Bump when the consent notice text changes materially — vendors re-consent. */
export const CONSENT_VERSION = "2026-09-v1";

/** Contact shown in the privacy notice for access, correction, deletion and grievances. */
export const PRIVACY_CONTACT_EMAIL = "hello@mechmetriq.com";

export function mask(last4: string | null | undefined): string | null {
  return last4 ? `••••••${last4}` : null;
}

export function clean(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

export function cleanUpper(v: FormDataEntryValue | null): string {
  return clean(v).toUpperCase().replace(/\s+/g, "");
}

export type FieldErrors = Partial<Record<string, string>>;

export interface KycFormState {
  error?: string;
  success?: string;
  fieldErrors?: FieldErrors;
  savedAt?: number;
}
