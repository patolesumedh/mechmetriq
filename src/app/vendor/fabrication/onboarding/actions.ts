"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { saveVendorKyc } from "@/lib/kyc/save";
import { GSTIN_RE, PINCODE_RE, clean, cleanUpper, type FieldErrors, type KycFormState } from "@/lib/kyc/rules";

export type OnboardingState = KycFormState;

const BUSINESS_TYPES = new Set([
  "Proprietorship",
  "Partnership",
  "Private Limited",
  "LLP",
  "Public Limited",
  "Other",
]);

export async function updateOnboardingAction(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const companyName = clean(formData.get("company_name"));
  const businessType = clean(formData.get("business_type"));
  const gstin = cleanUpper(formData.get("gstin"));
  const pincode = clean(formData.get("registered_pincode"));
  const typicalLeadTime = clean(formData.get("typical_lead_time"));
  const minOrderPolicy = clean(formData.get("min_order_policy"));
  const capabilities = formData.getAll("capabilities").map(String).filter(Boolean);
  const materialsMachined = formData.getAll("materials_machined").map(String).filter(Boolean);

  const errors: FieldErrors = {};
  if (!companyName) errors.company_name = "Legal business name is required.";
  if (companyName.length > 200) errors.company_name = "Name is too long.";
  if (businessType && !BUSINESS_TYPES.has(businessType)) errors.business_type = "Pick a business type.";
  if (gstin && !GSTIN_RE.test(gstin)) errors.gstin = "GSTIN should look like 27ABCDE1234F1Z5.";
  if (pincode && !PINCODE_RE.test(pincode)) errors.registered_pincode = "Pincode should be 6 digits.";

  const result = await saveVendorKyc({
    supabase,
    vendorId: user.id,
    formData,
    gstin: gstin || null,
    profileErrors: errors,
    profileUpdate: {
      company_name: companyName,
      business_type: businessType || null,
      gstin: gstin || null,
      registered_pincode: pincode || null,
      capabilities,
      materials_machined: materialsMachined,
      typical_lead_time: typicalLeadTime.slice(0, 100) || null,
      min_order_policy: minOrderPolicy.slice(0, 200) || null,
    },
  });

  if (result.success) revalidatePath("/vendor/fabrication", "layout");
  return result;
}
