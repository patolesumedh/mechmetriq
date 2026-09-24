"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { saveVendorKyc } from "@/lib/kyc/save";
import { GSTIN_RE, PINCODE_RE, clean, cleanUpper, type FieldErrors, type KycFormState } from "@/lib/kyc/rules";

export type OnboardingState = KycFormState;

export async function updateKycAction(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const companyName = clean(formData.get("company_name"));
  const businessType = clean(formData.get("business_type"));
  const gstin = cleanUpper(formData.get("gstin"));
  const warehousePincode = clean(formData.get("warehouse_pincode"));
  const minOrderPolicy = clean(formData.get("min_order_policy"));
  const materialsHandled = formData.getAll("materials_handled").map(String).filter(Boolean);

  const errors: FieldErrors = {};
  if (!companyName) errors.company_name = "Legal business name is required.";
  if (companyName.length > 200) errors.company_name = "Name is too long.";
  if (!gstin) errors.gstin = "GSTIN is required.";
  else if (!GSTIN_RE.test(gstin)) errors.gstin = "GSTIN should look like 27ABCDE1234F1Z5.";
  if (!warehousePincode) errors.warehouse_pincode = "Warehouse pincode is required.";
  else if (!PINCODE_RE.test(warehousePincode)) errors.warehouse_pincode = "Pincode should be 6 digits.";

  const result = await saveVendorKyc({
    supabase,
    vendorId: user.id,
    formData,
    gstin: gstin || null,
    profileErrors: errors,
    profileUpdate: {
      company_name: companyName,
      business_type: businessType.slice(0, 60) || null,
      gstin: gstin || null,
      warehouse_pincode: warehousePincode || null,
      materials_handled: materialsHandled.length ? materialsHandled : null,
      min_order_policy: minOrderPolicy.slice(0, 200) || null,
    },
  });

  if (result.success) revalidatePath("/vendor/raw_material", "layout");
  return result;
}
