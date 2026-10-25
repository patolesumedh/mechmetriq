import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata = { title: "Set a new password · MECHmetrIQ" };

// Reached from the reset email (via /auth/callback, which signs the user in
// with a recovery session) or from Account security when already logged in.
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password?error=link");

  // With two-factor login on, Supabase only lets a session that has also
  // passed the authenticator check (aal2) change the password. A reset link
  // alone gives aal1, so ask for the app code first, then come back here.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect("/mfa/verify?next=/reset-password");
  }

  return <ResetPasswordForm email={user.email ?? ""} />;
}
