"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface OnboardingState {
  error?: string;
}

export async function updateOnboardingAction(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const companyName = (formData.get("company_name") as string)?.trim();
  const businessType = (formData.get("business_type") as string) || null;
  const gstin = (formData.get("gstin") as string) || null;
  const pan = (formData.get("pan") as string) || null;
  const registeredAddress = (formData.get("registered_address") as string) || null;
  const registeredPincode = (formData.get("registered_pincode") as string) || null;
  const typicalLeadTime = (formData.get("typical_lead_time") as string) || null;
  const minOrderPolicy = (formData.get("min_order_policy") as string) || null;
  const bankAccountNumber = (formData.get("bank_account_number") as string) || null;
  const ifscCode = (formData.get("ifsc_code") as string) || null;
  const cancelledChequeUrl = (formData.get("cancelled_cheque_url") as string) || null;
  const certificationsUrl = (formData.get("certifications_url") as string) || null;
  const capabilities = formData.getAll("capabilities") as string[];
  const materialsMachined = formData.getAll("materials_machined") as string[];

  if (!companyName) {
    return { error: "Company / legal business name is required." };
  }

  const { data: existing } = await supabase
    .from("vendor_profiles")
    .select("kyc_status")
    .eq("id", user.id)
    .single();

  const { error } = await supabase
    .from("vendor_profiles")
    .update({
      company_name: companyName,
      business_type: businessType,
      gstin,
      pan,
      registered_address: registeredAddress,
      registered_pincode: registeredPincode,
      capabilities,
      materials_machined: materialsMachined,
      typical_lead_time: typicalLeadTime,
      min_order_policy: minOrderPolicy,
      bank_account_number: bankAccountNumber,
      ifsc_code: ifscCode,
      cancelled_cheque_url: cancelledChequeUrl,
      certifications_url: certificationsUrl,
      kyc_status: existing?.kyc_status === "draft" ? "pending" : existing?.kyc_status,
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  redirect("/vendor/fabrication/onboarding?saved=1");
}
