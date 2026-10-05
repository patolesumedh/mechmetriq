"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { GSTIN_RE, PINCODE_RE, clean, cleanUpper } from "@/lib/kyc/rules";

export interface ProfileState {
  error?: string;
  success?: boolean;
}

export async function updateProfileAction(
  _prevState: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = clean(formData.get("full_name"));
  const phone = clean(formData.get("phone"));
  const billingAddress = clean(formData.get("billing_address"));
  const billingPincode = clean(formData.get("billing_pincode"));
  const gstRegistered = formData.get("gst_registered") === "on";
  const organizationName = clean(formData.get("organization_name"));
  const gstin = cleanUpper(formData.get("gstin"));

  if (!fullName) {
    return { error: "Full name is required." };
  }
  if (!phone) {
    return { error: "Contact number is required." };
  }
  if (!billingAddress) {
    return { error: "Billing address is required." };
  }
  if (!billingPincode || !PINCODE_RE.test(billingPincode)) {
    return { error: "Enter a valid 6-digit billing pincode." };
  }
  if (gstRegistered) {
    if (!organizationName) {
      return { error: "Organization name is required when GST registered is checked." };
    }
    if (!gstin || !GSTIN_RE.test(gstin)) {
      return { error: "Enter a valid GSTIN (e.g. 22AAAAA0000A1Z5)." };
    }
  } else if (gstin && !GSTIN_RE.test(gstin)) {
    return { error: "Enter a valid GSTIN (e.g. 22AAAAA0000A1Z5), or leave it blank." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone,
      billing_address: billingAddress,
      billing_pincode: billingPincode,
      gst_registered: gstRegistered,
      organization_name: organizationName || null,
      gstin: gstin || null,
    })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/buyer/profile");
  revalidatePath("/buyer");
  return { success: true };
}
