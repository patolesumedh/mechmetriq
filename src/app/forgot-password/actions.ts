"use server";

import { createEmailLinkClient } from "@/lib/supabase/emailLinks";
import { siteUrl } from "@/lib/auth/siteUrl";
import { isValidEmail } from "@/lib/auth/validation";

export interface ForgotPasswordState {
  error?: string;
  sent?: boolean;
}

export async function forgotPasswordAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return { error: "Enter the email address you signed up with." };
  }

  // Implicit-flow link, so it works in any browser (see emailLinks.ts).
  const supabase = createEmailLinkClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteUrl()}/auth/callback?next=/reset-password`,
  });

  // Supabase rate-limits these emails; tell the user, but never reveal
  // whether the address has an account.
  if (error && error.status === 429) {
    return { error: "Too many reset requests. Please wait a few minutes and try again." };
  }
  return { sent: true };
}
