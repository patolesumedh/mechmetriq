"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface RegisterState {
  error?: string;
}

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const accountType = formData.get("accountType") as string; // "buyer" | "vendor"
  const vendorType = formData.get("vendorType") as string | null; // "fabrication" | "raw_material"
  const fullName = formData.get("fullName") as string;
  const companyName = formData.get("companyName") as string | null;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;
  const gstin = formData.get("gstin") as string | null;
  const agreeTerms = formData.get("agreeTerms");

  if (!agreeTerms) {
    return { error: "You must agree to the Terms of Service and Privacy Policy." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }
  if (accountType === "vendor" && !companyName) {
    return { error: "Company name is required for vendor accounts." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: accountType,
        vendor_type: accountType === "vendor" ? vendorType : null,
        full_name: fullName,
        company_name: companyName,
        phone,
        gstin,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect(
    accountType === "vendor" ? `/vendor/${vendorType}/onboarding` : "/buyer"
  );
}
