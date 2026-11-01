import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesUpdate } from "@/lib/types/database";
import type { FieldErrors, KycFormState } from "./rules";
import { canEditKyc, canSubmitKyc, isUnderReview } from "./status";
import { loadCompleteness } from "./completeness";
import { commitDetails, loadDetailsRow, prepareDetails } from "./details";
import { KycConfigError, panHash } from "./crypto";
import { commitKyc, gstinMatchesPan, loadKycRow, prepareKyc } from "./server";

type Client = SupabaseClient<Database>;

/**
 * Shared save flow for both vendor KYC forms. Saving never submits: the
 * vendor submits from the Review & Submit page (F5.1).
 *
 * 1. Validate the profile fields (caller) and the sensitive fields (here) —
 *    nothing is written if anything is invalid.
 * 2. Encrypt + store the sensitive fields in vendor_kyc (plus the PAN hashes
 *    used by the duplicate-vendor check, F5.2).
 * 3. Update the non-sensitive vendor_profiles fields.
 */
export async function saveVendorKyc({
  supabase,
  vendorId,
  formData,
  profileUpdate,
  profileErrors,
  gstin,
  portal,
}: {
  supabase: Client;
  vendorId: string;
  formData: FormData;
  profileUpdate: TablesUpdate<"vendor_profiles">;
  profileErrors: FieldErrors;
  gstin: string | null;
  /** Which portal's form this is (capability fields differ). */
  portal: "fabrication" | "raw_material";
}): Promise<KycFormState> {
  const { data: current } = await supabase
    .from("vendor_profiles")
    .select("kyc_status, vendor_type")
    .eq("id", vendorId)
    .single();
  if (!current) return { error: "Vendor profile not found." };
  if (!canEditKyc(current.kyc_status)) {
    return {
      error: isUnderReview(current.kyc_status)
        ? "Your application is being reviewed, so it can't be changed right now."
        : "Your KYC can't be changed right now. Please contact support.",
    };
  }

  const [existing, existingDetails] = await Promise.all([
    loadKycRow(supabase, vendorId),
    loadDetailsRow(supabase, vendorId),
  ]);
  const details = prepareDetails(formData, vendorId, existingDetails, portal);

  let result: ReturnType<typeof prepareKyc>;
  try {
    result = prepareKyc(formData, vendorId, existing, current.vendor_type);
    if ("prepared" in result) {
      result.prepared.row.gstin_pan_hash = gstin ? panHash(gstin.slice(2, 12)) : null;
    }
  } catch (e) {
    if (e instanceof KycConfigError) console.error(e.message);
    return {
      error:
        "We couldn't save your details securely right now. Please try again later or contact support.",
    };
  }

  const errors: FieldErrors = {
    ...profileErrors,
    ...("errors" in details ? details.errors : {}),
    ...("errors" in result ? result.errors : {}),
  };
  if ("prepared" in result && gstin && !gstinMatchesPan(gstin, result.prepared.effectivePan)) {
    errors.gstin = "This GSTIN doesn't match the PAN (characters 3–12 of a GSTIN are the PAN).";
  }
  if (Object.keys(errors).length || !("prepared" in result) || "errors" in details) {
    return { error: "Please fix the highlighted fields.", fieldErrors: errors };
  }
  const { prepared } = result;

  const { error } = await supabase.from("vendor_profiles").update(profileUpdate).eq("id", vendorId);
  if (error) {
    console.error("vendor_profiles update failed", error.code);
    return { error: "We couldn't save your details. Please try again." };
  }
  if (!(await commitDetails(supabase, details.row)) || !(await commitKyc(supabase, prepared))) {
    return { error: "We couldn't save your details. Please try again." };
  }

  if (!canSubmitKyc(current.kyc_status)) {
    return { success: "Your details have been saved.", savedAt: Date.now() };
  }
  const { missing } = await loadCompleteness(supabase, vendorId);
  return {
    success: missing.length
      ? `Saved. Still needed before you can submit: ${missing.map((m) => m.label.toLowerCase()).join(", ")}.`
      : "Saved. Everything required is filled in — click Review & submit to send your application.",
    savedAt: Date.now(),
  };
}
