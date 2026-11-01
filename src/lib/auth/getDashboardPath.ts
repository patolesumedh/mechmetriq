import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Given a signed-in user's id, figures out the one screen they should land on
 * for their current status (F1.5). Shared by the login action, the dashboard
 * layouts (via requireAccountFor) and anywhere that bounces an already
 * authenticated visitor away from login/register.
 *
 *   suspended account / vendor suspended    → /account/suspended
 *   new account, email not verified        → /verify/email
 *   authenticator app on, code not entered → /mfa/verify (any role)
 *   admin without an authenticator app     → /mfa/setup (required for admins)
 *   vendor in draft / rejected / correction → /vendor/<portal>/onboarding
 *   vendor submitted / under review        → /account/under-review
 *   everyone else                          → their dashboard
 */
export async function getDashboardPath(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, account_status, email_verified, verification_required")
    .eq("id", userId)
    .single();

  if (!profile) return "/buyer";
  if (profile.account_status === "suspended") return "/account/suspended";

  // Mobile (SMS) verification is switched off for now; only email is checked.
  if (profile.verification_required && !profile.email_verified) return "/verify/email";

  // Anyone who has turned on an authenticator app must enter its code.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") return "/mfa/verify";

  if (profile.role === "admin") {
    return aal?.currentLevel === "aal2" ? "/admin" : "/mfa/setup";
  }

  if (profile.role === "vendor") {
    const { data: vendorProfile } = await supabase
      .from("vendor_profiles")
      .select("vendor_type, kyc_status")
      .eq("id", userId)
      .single();
    // "both" vendors land in the fabrication portal and can switch (F5.6).
    const portal = vendorProfile?.vendor_type === "raw_material" ? "raw_material" : "fabrication";
    switch (vendorProfile?.kyc_status) {
      case "approved":
        return `/vendor/${portal}`;
      case "pending":
      case "under_review":
        return "/account/under-review";
      case "on_hold":
      case "suspended":
        return "/account/suspended";
      default: // draft, rejected, correction_required
        return `/vendor/${portal}/onboarding`;
    }
  }

  return "/buyer";
}
