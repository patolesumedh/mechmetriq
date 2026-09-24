import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesUpdate } from "@/lib/types/database";
import type { FieldErrors, KycFormState } from "./rules";
import { KycConfigError } from "./crypto";
import { commitKyc, gstinMatchesPan, loadKycRow, logKycEvent, prepareKyc } from "./server";

type Client = SupabaseClient<Database>;

/**
 * Shared save flow for both vendor KYC forms.
 *
 * 1. Validate the profile fields (caller) and the sensitive fields (here) —
 *    nothing is written if anything is invalid.
 * 2. Encrypt + store the sensitive fields in vendor_kyc.
 * 3. Update the non-sensitive vendor_profiles fields and, when everything
 *    required is present, move the KYC from draft/rejected to pending.
 */
export async function saveVendorKyc({
  supabase,
  vendorId,
  formData,
  profileUpdate,
  profileErrors,
  gstin,
}: {
  supabase: Client;
  vendorId: string;
  formData: FormData;
  profileUpdate: TablesUpdate<"vendor_profiles">;
  profileErrors: FieldErrors;
  gstin: string | null;
}): Promise<KycFormState> {
  const { data: current } = await supabase
    .from("vendor_profiles")
    .select("kyc_status")
    .eq("id", vendorId)
    .single();
  if (!current) return { error: "Vendor profile not found." };

  const existing = await loadKycRow(supabase, vendorId);

  let result: ReturnType<typeof prepareKyc>;
  try {
    result = prepareKyc(formData, vendorId, existing);
  } catch (e) {
    if (e instanceof KycConfigError) console.error(e.message);
    return {
      error:
        "We couldn't save your details securely right now. Please try again later or contact support.",
    };
  }

  const errors: FieldErrors = { ...profileErrors, ...("errors" in result ? result.errors : {}) };
  if ("prepared" in result && gstin && !gstinMatchesPan(gstin, result.prepared.effectivePan)) {
    errors.gstin = "This GSTIN doesn't match the PAN (characters 3–12 of a GSTIN are the PAN).";
  }
  if (Object.keys(errors).length || !("prepared" in result)) {
    return { error: "Please fix the highlighted fields.", fieldErrors: errors };
  }
  const { prepared } = result;

  if (!(await commitKyc(supabase, prepared))) {
    return { error: "We couldn't save your details. Please try again." };
  }

  const canSubmit = current.kyc_status === "draft" || current.kyc_status === "rejected";
  const complete = prepared.missingForSubmission.length === 0;
  const submitting = canSubmit && complete;

  const { error } = await supabase
    .from("vendor_profiles")
    .update({ ...profileUpdate, ...(submitting ? { kyc_status: "pending" as const } : {}) })
    .eq("id", vendorId);
  if (error) {
    console.error("vendor_profiles update failed", error.code);
    return { error: "We couldn't save your details. Please try again." };
  }

  if (submitting) await logKycEvent(supabase, vendorId, "submit");

  if (submitting) {
    return {
      success: "Your KYC has been submitted. Our team will review it shortly.",
      savedAt: Date.now(),
    };
  }
  if (canSubmit) {
    return {
      success: `Saved as draft. To submit for approval, add: ${prepared.missingForSubmission.join(", ")}.`,
      savedAt: Date.now(),
    };
  }
  return { success: "Your details have been saved.", savedAt: Date.now() };
}
