"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface OnboardingState {
  error?: string;
  success?: string;
}

export async function updateKycAction(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const companyName = (formData.get("company_name") as string | null)?.trim();
  const businessType = (formData.get("business_type") as string | null)?.trim();
  const gstin = (formData.get("gstin") as string | null)?.trim();
  const pan = (formData.get("pan") as string | null)?.trim();
  const registeredAddress = (formData.get("registered_address") as string | null)?.trim();
  const warehousePincode = (formData.get("warehouse_pincode") as string | null)?.trim();
  const minOrderPolicy = (formData.get("min_order_policy") as string | null)?.trim();
  const bankAccountNumber = (formData.get("bank_account_number") as string | null)?.trim();
  const ifscCode = (formData.get("ifsc_code") as string | null)?.trim();
  const cancelledChequeUrl = (formData.get("cancelled_cheque_url") as string | null)?.trim();
  const certificationsUrl = (formData.get("certifications_url") as string | null)?.trim();
  const materialsHandled = formData.getAll("materials_handled").map(String).filter(Boolean);

  if (!companyName || !gstin || !pan || !registeredAddress || !warehousePincode) {
    return {
      error:
        "Please fill in company name, GSTIN, PAN, registered address, and warehouse pincode.",
    };
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
      business_type: businessType || null,
      gstin: gstin || null,
      pan: pan || null,
      registered_address: registeredAddress || null,
      warehouse_pincode: warehousePincode || null,
      materials_handled: materialsHandled.length ? materialsHandled : null,
      min_order_policy: minOrderPolicy || null,
      bank_account_number: bankAccountNumber || null,
      ifsc_code: ifscCode || null,
      cancelled_cheque_url: cancelledChequeUrl || null,
      certifications_url: certificationsUrl || null,
      kyc_status: existing?.kyc_status === "draft" ? "pending" : existing?.kyc_status,
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/vendor/raw_material", "layout");

  return {
    success:
      existing?.kyc_status === "draft"
        ? "Your KYC details have been submitted for admin review."
        : "Your KYC details have been saved.",
  };
}
