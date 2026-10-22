"use server";

import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/auth/siteUrl";
import { isValidEmail } from "@/lib/auth/validation";

export interface ResendState {
  error?: string;
  sent?: boolean;
}

export async function resendVerificationAction(
  _prevState: ResendState,
  formData: FormData
): Promise<ResendState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) return { error: "Enter the email you signed up with." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${await siteUrl()}/auth/callback` },
  });

  if (error?.status === 429) {
    return { error: "Please wait a minute before asking for another email." };
  }
  // Same answer whether or not the address exists.
  return { sent: true };
}
