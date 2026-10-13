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

// ---------------------------------------------------------------------------
// Onboarding journey steps 2–5: business profile, contact & operations,
// capability, additional documents.
// ---------------------------------------------------------------------------

export type VendorKind = "fabrication" | "raw_material";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MOBILE_RE = /^[6-9][0-9]{9}$/;
export const UDYAM_RE = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;
export const URL_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;

/** 10-digit Indian mobile: strips spaces, dashes and a +91 / 0 prefix. */
export function cleanMobile(v: FormDataEntryValue | null): string {
  return clean(v).replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=[6-9][0-9]{9}$)/, "");
}

export const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

export const INDUSTRIES = [
  "Automotive", "Aerospace", "Defence", "Medical devices", "Electronics", "Energy & power",
  "Oil & gas", "Industrial machinery", "Railways", "Agriculture", "Consumer products",
  "Construction", "Robotics & automation",
];

export const INSPECTION_TOOLS = [
  "Vernier / micrometer", "Height gauge", "Bore gauge", "Thread gauges", "Profile projector",
  "Surface roughness tester", "Hardness tester", "CMM", "Vision measuring system",
];

export const TOLERANCE_OPTIONS = [
  "±0.2 mm (general)", "±0.1 mm", "±0.05 mm", "±0.02 mm", "±0.01 mm", "±0.005 mm or tighter",
];

export interface DocKind {
  key: string;
  label: string;
  hint?: string;
  max: number;
  for: "both" | VendorKind;
  /** Needed before the vendor can submit for approval. */
  required?: boolean;
  /** Needed only when a GSTIN is entered. */
  requiredWithGstin?: boolean;
}

export const DOC_KINDS: DocKind[] = [
  {
    key: "registration_proof",
    label: "Business registration proof",
    hint: "Incorporation certificate, partnership deed, shop & establishment licence, etc.",
    max: 2,
    for: "both",
    required: true,
  },
  {
    key: "gst_certificate",
    label: "GST registration certificate",
    hint: "Required if you entered a GSTIN.",
    max: 1,
    for: "both",
    requiredWithGstin: true,
  },
  { key: "udyam_certificate", label: "Udyam / MSME certificate", hint: "If registered.", max: 1, for: "both" },
  {
    key: "address_proof",
    label: "Factory / warehouse address proof",
    hint: "Rent agreement, electricity bill or property tax receipt.",
    max: 2,
    for: "both",
  },
  { key: "facility_photos", label: "Machinery / facility photos", max: 6, for: "both" },
  { key: "product_catalogue", label: "Product catalogue / company brochure", max: 2, for: "both" },
  {
    key: "test_certificates",
    label: "Test / grade certificates (MTC samples)",
    max: 5,
    for: "raw_material",
  },
  {
    key: "manufacturer_authorisation",
    label: "Manufacturer / dealer authorisation",
    hint: "If you are an authorised distributor of a brand.",
    max: 3,
    for: "raw_material",
  },
];

export function docKindsFor(kind: VendorKind): DocKind[] {
  return DOC_KINDS.filter((d) => d.for === "both" || d.for === kind);
}

export type DocMap = Record<string, string[]>;

export function parseDocMap(v: unknown): DocMap {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: DocMap = {};
  for (const [k, paths] of Object.entries(v as Record<string, unknown>)) {
    if (Array.isArray(paths)) out[k] = paths.filter((p): p is string => typeof p === "string");
  }
  return out;
}
