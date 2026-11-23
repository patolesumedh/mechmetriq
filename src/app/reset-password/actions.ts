"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";
import { passwordProblem } from "@/lib/auth/validation";
import { isPasswordLeaked, LEAKED_PASSWORD_MESSAGE } from "@/lib/auth/pwned";

export interface ResetPasswordState {
  error?: string;
}

export async function resetPasswordAction(
  _prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password?error=link");

  const problem = passwordProblem(password, user.email);
  if (problem) return { error: problem };
  if (password !== confirmPassword) return { error: "Passwords do not match." };
  if (await isPasswordLeaked(password)) return { error: LEAKED_PASSWORD_MESSAGE };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") {
      return { error: "Choose a password you haven't used for this account." };
    }
    if (error.code === "insufficient_aal") {
      // Two-factor login is on: enter the authenticator code, then retry.
      redirect("/mfa/verify?next=/reset-password");
    }
    if (error.code === "reauthentication_needed") {
      return { error: "For security, log out and use “Forgot password?” to set a new password." };
    }
    return { error: error.message };
  }

  // Anyone else holding the old password is signed out everywhere.
  await supabase.auth.signOut({ scope: "others" });

  redirect(await getDashboardPath(supabase, user.id));
}
