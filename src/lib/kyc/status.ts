import type { Database } from "@/lib/types/database";

/*
 * Vendor KYC statuses, review sections and declarations (E5).
 * Safe to import from client and server code.
 */

export type KycStatus = Database["public"]["Enums"]["kyc_status"];
export type VendorType = Database["public"]["Enums"]["vendor_type"];
export type Portal = "fabrication" | "raw_material";

/** Vendor-facing name for each status. "pending" is shown as Submitted. */
export const KYC_STATUS_LABEL: Record<KycStatus, string> = {
  draft: "Draft",
  pending: "Submitted",
  under_review: "Under review",
  correction_required: "Correction required",
  approved: "Approved",
  rejected: "Rejected",
  on_hold: "Suspended",
  suspended: "Suspended",
};

/** The vendor can edit their KYC in these states (not while it's being reviewed). */
export function canEditKyc(status: KycStatus): boolean {
  return status === "draft" || status === "rejected" || status === "correction_required" || status === "approved";
}

/** The vendor can (re)submit their application in these states. */
export function canSubmitKyc(status: KycStatus): boolean {
  return status === "draft" || status === "rejected" || status === "correction_required";
}

export function isUnderReview(status: KycStatus): boolean {
  return status === "pending" || status === "under_review";
}

export function isSuspended(status: KycStatus): boolean {
  return status === "suspended" || status === "on_hold";
}

/** Sections an admin can send correction remarks on (F5.4). */
export const REVIEW_SECTIONS = [
  { key: "business", label: "Business details", anchor: "kyc-business" },
  { key: "contact", label: "Primary contact", anchor: "kyc-contact" },
  { key: "operations", label: "Facility & operations", anchor: "kyc-operations" },
  { key: "capability", label: "Capabilities", anchor: "kyc-capability" },
  { key: "bank", label: "Bank & payout", anchor: "kyc-bank" },
  { key: "documents", label: "Business documents", anchor: "kyc-documents" },
] as const;

export type ReviewSection = (typeof REVIEW_SECTIONS)[number]["key"];
export type CorrectionRemarks = Partial<Record<ReviewSection, string>>;

export function parseRemarks(v: unknown): CorrectionRemarks {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: CorrectionRemarks = {};
  for (const s of REVIEW_SECTIONS) {
    const val = (v as Record<string, unknown>)[s.key];
    if (typeof val === "string" && val.trim()) out[s.key] = val.trim();
  }
  return out;
}

/** Declarations accepted on Review & Submit (F5.1). Bump the version when the text changes. */
export const DECLARATIONS_VERSION = "2026-11-v1";
export const DECLARATIONS = [
  "The information and documents in this application are true, complete and belong to this business.",
  "I am authorised to submit this application and to sign agreements on behalf of this business.",
  "I agree to work with MECHmetrIQ as a contracted vendor: orders are assigned at agreed rates, and I will keep the drawings and data I receive confidential.",
];

/** Which portals a vendor type can open, first one is the default landing portal. */
export function portalsFor(type: VendorType): Portal[] {
  if (type === "both") return ["fabrication", "raw_material"];
  return [type];
}

export const PORTAL_LABEL: Record<Portal, string> = {
  fabrication: "Fabrication",
  raw_material: "Raw material",
};

export const VENDOR_TYPE_LABEL: Record<VendorType, string> = {
  fabrication: "Fabrication",
  raw_material: "Raw material",
  both: "Fabrication + Raw material",
};
