import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/types/database";
import type { DetailsRow } from "./details";
import { loadDetailsRow } from "./details";
import { CONSENT_VERSION, docKindsFor, parseDocMap } from "./rules";
import { loadKycRow } from "./server";
import type { ReviewSection } from "./status";

type Client = SupabaseClient<Database>;

export interface MissingItem {
  section: ReviewSection | "consent";
  label: string;
}

/**
 * Everything a vendor must fill in before Review & Submit (F5.1), checked
 * from what is saved — not from a form — so the review page, the save
 * message and the submit action all agree.
 */
export function findMissing(
  vendor: Tables<"vendor_profiles">,
  kyc: Tables<"vendor_kyc"> | null,
  details: DetailsRow | null
): MissingItem[] {
  const out: MissingItem[] = [];
  const need = (ok: unknown, section: MissingItem["section"], label: string) => {
    if (!ok || (Array.isArray(ok) && ok.length === 0)) out.push({ section, label });
  };
  const fab = vendor.vendor_type !== "raw_material";
  const raw = vendor.vendor_type !== "fabrication";

  need(vendor.company_name?.trim(), "business", "Legal business name");
  need(vendor.business_type, "business", "Business type");
  need(details?.year_established, "business", "Year of establishment");
  need(details?.business_email, "business", "Business email");
  if (raw) need(vendor.gstin, "business", "GSTIN");
  need(kyc?.pan_enc, "business", "PAN");
  need(kyc?.registered_address, "business", "Registered address");
  need(kyc?.city, "business", "City");
  need(kyc?.state, "business", "State");
  if (fab) need(vendor.registered_pincode, "business", "Registered pincode");
  if (raw) need(vendor.warehouse_pincode, "business", "Warehouse / dispatch pincode");

  need(kyc?.contact_name, "contact", "Primary contact name");
  need(kyc?.contact_designation, "contact", "Primary contact designation");
  need(kyc?.contact_mobile, "contact", "Primary contact mobile");
  need(kyc?.contact_email, "contact", "Primary contact email");

  if (fab) need(vendor.capabilities, "capability", "At least one process offered");
  if (raw) need(vendor.materials_handled, "capability", "At least one material supplied");

  need(kyc?.account_holder_name, "bank", "Account holder name");
  need(kyc?.bank_account_enc, "bank", "Bank account number");
  need(kyc?.ifsc_enc, "bank", "IFSC code");
  need(kyc?.cancelled_cheque_path, "bank", "Cancelled cheque / passbook image");

  const docs = parseDocMap(kyc?.documents);
  for (const d of docKindsFor(vendor.vendor_type)) {
    if (d.required || (d.requiredWithGstin && vendor.gstin)) need(docs[d.key]?.length, "documents", d.label);
  }

  need(kyc?.consent_version === CONSENT_VERSION && kyc?.consent_at, "consent", "Privacy consent");
  return out;
}

export async function loadCompleteness(supabase: Client, vendorId: string) {
  const [{ data: vendor }, kyc, details] = await Promise.all([
    supabase.from("vendor_profiles").select("*").eq("id", vendorId).single(),
    loadKycRow(supabase, vendorId),
    loadDetailsRow(supabase, vendorId),
  ]);
  return { vendor, kyc, details, missing: vendor ? findMissing(vendor, kyc, details) : [] };
}
