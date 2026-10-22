"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";
import { siteUrl } from "@/lib/auth/siteUrl";
import { isValidEmail } from "@/lib/auth/validation";

export interface VerifyEmailState {
  email: string;
  error?: string;
  notice?: string;
}

/**
 * Email verification by code, switched on `intent`:
 *   verify → checks the 6-digit code from the sign-up email; on success the
 *            user is signed in and sent to the screen for their status
 *   resend → sends the sign-up email again
 * The code appears in the email once the "Confirm signup" template includes
 * {{ .Token }} (see AUTH-SECURITY.md); the link in the email keeps working.
 */
export async function verifyEmailAction(
  prev: VerifyEmailState,
  formData: FormData
): Promise<VerifyEmailState> {
  const intent = String(formData.get("intent") ?? "");
  const email = String(formData.get("email") ?? prev.email).trim().toLowerCase();
  if (!isValidEmail(email)) return { email, error: "Enter the email you signed up with." };

  const supabase = await createClient();

  if (intent === "resend") {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${await siteUrl()}/auth/callback` },
    });
    if (error?.status === 429) {
      return { email, error: "Please wait a minute before asking for another email." };
    }
    // Same answer whether or not the address exists.
    return { email, notice: "Sent. Check your inbox (and spam folder) for a new code." };
  }

  const token = String(formData.get("token") ?? "").replace(/\D/g, "");
  if (token.length < 6 || token.length > 10) return { email, error: "Enter the code from the email." };

  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) {
    return {
      email,
      error:
        error?.code === "otp_expired"
          ? "That code is wrong or has expired. Check the newest email, or send a new code."
          : (error?.message ?? "Couldn't verify that code."),
    };
  }

  redirect(await getDashboardPath(supabase, data.user.id));
}
