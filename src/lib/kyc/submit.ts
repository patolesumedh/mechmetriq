"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadCompleteness } from "./completeness";
import { logKycEvent } from "./server";
import { DECLARATIONS, DECLARATIONS_VERSION, canSubmitKyc } from "./status";

export interface SubmitState {
  error?: string;
}

/**
 * Review & Submit (F5.1): all declarations ticked, nothing missing, then
 * vendor_submit_kyc() moves the KYC to Submitted and issues the application ID.
 */
export async function submitKycAction(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  for (let i = 0; i < DECLARATIONS.length; i++) {
    if (formData.get(`declaration_${i}`) !== "yes") {
      return { error: "Please tick every declaration to submit." };
    }
  }

  const { vendor, missing } = await loadCompleteness(supabase, user.id);
  if (!vendor) return { error: "Vendor profile not found." };
  if (!canSubmitKyc(vendor.kyc_status)) return { error: "This application has already been submitted." };
  if (missing.length) {
    return { error: `Still needed: ${missing.map((m) => m.label.toLowerCase()).join(", ")}.` };
  }

  const { error } = await supabase.rpc("vendor_submit_kyc", { p_declarations_version: DECLARATIONS_VERSION });
  if (error) {
    console.error("vendor_submit_kyc failed", error.code);
    return { error: error.message || "We couldn't submit your application. Please try again." };
  }
  await logKycEvent(supabase, user.id, "submit");
  redirect("/account/under-review");
}
