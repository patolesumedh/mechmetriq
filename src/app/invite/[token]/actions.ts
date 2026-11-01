"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createEmailLinkClient } from "@/lib/supabase/emailLinks";
import { siteUrl } from "@/lib/auth/siteUrl";
import { isPasswordLeaked, LEAKED_PASSWORD_MESSAGE } from "@/lib/auth/pwned";
import { isValidGstin, normalizeMobile, passwordProblem } from "@/lib/auth/validation";
import { PENDING_EMAIL_COOKIE } from "@/app/verify/email/constants";

export interface AcceptState {
  error?: string;
  values?: Record<string, string>;
}

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

/**
 * Accepting an admin invitation (F5.5). The email, vendor type and the
 * invitation's validity come from the database, never from the form. It is a
 * normal sign-up after that: the vendor still verifies their email and goes
 * through KYC review.
 */
export async function acceptInviteAction(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const token = str(formData.get("token"));
  const fullName = str(formData.get("fullName"));
  const companyName = str(formData.get("companyName"));
  const rawPhone = str(formData.get("phone"));
  const phone = normalizeMobile(rawPhone);
  const gstin = str(formData.get("gstin")).toUpperCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const agreeTerms = formData.get("agreeTerms") === "on";
  const fail = (error: string): AcceptState => ({
    error,
    values: { fullName, companyName, phone: rawPhone, gstin },
  });

  const supabase = await createClient();
  const { data: rows } = await supabase.rpc("vendor_invite_lookup", { p_token: token });
  const invite = rows?.[0];
  if (!invite || invite.status !== "valid") {
    return { error: "This invitation link is no longer valid. Ask the MECHmetrIQ team to resend it." };
  }

  if (!fullName || fullName.length > 120) return fail("Enter your full name.");
  if (!companyName || companyName.length > 200) return fail("Enter your company name.");
  if (!phone) return fail("Enter a valid 10-digit Indian mobile number.");
  if (!isValidGstin(gstin)) return fail("Enter a valid 15-character GSTIN (e.g. 27AAPFU0939F1ZV).");
  const problem = passwordProblem(password, invite.email);
  if (problem) return fail(problem);
  if (password !== confirmPassword) return fail("Passwords do not match.");
  if (!agreeTerms) return fail("You must agree to the Terms of Service and Privacy Policy.");
  if (await isPasswordLeaked(password)) return fail(LEAKED_PASSWORD_MESSAGE);

  const { data, error } = await createEmailLinkClient().auth.signUp({
    email: invite.email,
    password,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/callback`,
      data: {
        role: "vendor",
        vendor_type: invite.vendor_type,
        full_name: fullName,
        company_name: companyName,
        phone,
        gstin,
        terms_accepted: true,
      },
    },
  });
  if (error) {
    if (error.code === "user_already_exists") return fail("An account with this email already exists. Log in instead.");
    if (error.code === "weak_password") return fail(`Password is too weak. ${error.message}`);
    return fail(error.message);
  }
  if (!data.user || data.user.identities?.length === 0) {
    return fail("An account with this email already exists. Log in instead.");
  }

  // Single use: the link stops working once an account exists for it.
  const { error: markError } = await supabase.rpc("vendor_invite_mark_accepted", {
    p_token: token,
    p_user_id: data.user.id,
  });
  if (markError) console.error("vendor_invite_mark_accepted failed", markError.code);

  if (!data.session) {
    (await cookies()).set(PENDING_EMAIL_COOKIE, invite.email, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/verify",
      maxAge: 60 * 60,
    });
    redirect("/verify/email");
  }
  await supabase.auth.setSession(data.session);
  redirect(`/vendor/${invite.vendor_type === "raw_material" ? "raw_material" : "fabrication"}/onboarding`);
}
