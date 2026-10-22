"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";
import { siteUrl } from "@/lib/auth/siteUrl";
import { isPasswordLeaked, LEAKED_PASSWORD_MESSAGE } from "@/lib/auth/pwned";
import { isValidEmail, isValidGstin, normalizeMobile, passwordProblem } from "@/lib/auth/validation";
import { PENDING_EMAIL_COOKIE } from "@/app/verify/email/constants";

export interface RegisterState {
  error?: string;
  /** What the user typed, so a rejected form doesn't come back empty. */
  values?: Record<string, string>;
}

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

export async function registerAction(
  _prevState: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const accountType = str(formData.get("accountType")); // "buyer" | "vendor"
  const vendorType = str(formData.get("vendorType")); // "fabrication" | "raw_material"
  const fullName = str(formData.get("fullName"));
  const companyName = str(formData.get("companyName"));
  const email = str(formData.get("email")).toLowerCase();
  const rawPhone = str(formData.get("phone"));
  const phone = normalizeMobile(rawPhone);
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const gstin = str(formData.get("gstin")).toUpperCase();
  const agreeTerms = formData.get("agreeTerms") === "on";

  const fail = (error: string): RegisterState => ({
    error,
    values: { fullName, companyName, email, phone: rawPhone, gstin },
  });

  // Every rule is checked here on the server; the form's `required`
  // attributes are only a convenience. The signup trigger checks them again.
  if (accountType !== "buyer" && accountType !== "vendor") {
    return fail("Choose whether you're signing up as a buyer or a vendor.");
  }
  const isVendor = accountType === "vendor";
  if (isVendor && vendorType !== "fabrication" && vendorType !== "raw_material") {
    return fail("Choose a vendor type.");
  }
  if (!fullName || fullName.length > 120) return fail("Enter your full name.");
  if (isVendor && !companyName) return fail("Company name is required for vendor accounts.");
  if (!isValidEmail(email)) return fail("Enter a valid email address.");
  if (!phone) return fail("Enter a valid 10-digit Indian mobile number.");
  if (isVendor && !isValidGstin(gstin)) {
    return fail("Enter a valid 15-character GSTIN (e.g. 27AAPFU0939F1ZV).");
  }
  const problem = passwordProblem(password, email);
  if (problem) return fail(problem);
  if (password !== confirmPassword) return fail("Passwords do not match.");
  if (!agreeTerms) {
    return fail("You must agree to the Terms of Service and Privacy Policy.");
  }
  if (await isPasswordLeaked(password)) return fail(LEAKED_PASSWORD_MESSAGE);

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/callback`,
      data: {
        role: accountType,
        vendor_type: isVendor ? vendorType : null,
        full_name: fullName,
        company_name: isVendor ? companyName : null,
        phone,
        gstin: isVendor ? gstin : null,
        terms_accepted: true,
      },
    },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      return fail("An account with this email already exists. Log in or reset your password.");
    }
    if (error.code === "weak_password") return fail(`Password is too weak. ${error.message}`);
    return fail(error.message);
  }

  // Supabase returns an obfuscated user with no identities when the email is
  // already registered (to avoid account enumeration).
  if (data.user && data.user.identities?.length === 0) {
    return fail("An account with this email already exists. Log in or reset your password.");
  }

  if (!data.session) {
    // Email confirmation is on: wait for the user to click the link.
    (await cookies()).set(PENDING_EMAIL_COOKIE, email, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/verify",
      maxAge: 60 * 60,
    });
    redirect("/verify/email");
  }

  redirect(await getDashboardPath(supabase, data.session.user.id));
}
