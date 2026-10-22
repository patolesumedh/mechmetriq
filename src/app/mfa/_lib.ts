import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";

/** Only lets through users whose status-based landing page is `path`. */
export async function requireLanding(path: "/mfa/verify") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const next = await getDashboardPath(supabase, user.id);
  if (next !== path) redirect(next);
  return user;
}

/**
 * Authenticator-app setup: required for admins (their landing page is
 * /mfa/setup), optional for buyers and vendors who open it from Account
 * security. Returns whether it is the required admin setup.
 */
export async function requireMfaSetupAccess(): Promise<{ required: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const home = await getDashboardPath(supabase, user.id);
  if (home === "/mfa/setup") return { required: true };
  if (home.startsWith("/verify/") || home.startsWith("/mfa/") || home === "/account/suspended") redirect(home);

  const { data: factors } = await supabase.auth.mfa.listFactors();
  if ((factors?.totp ?? []).length > 0) redirect("/account/security");
  return { required: false };
}
