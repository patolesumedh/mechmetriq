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

  return <ResetPasswordForm email={user.email ?? ""} />;
}
