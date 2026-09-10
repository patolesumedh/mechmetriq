import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Given a signed-in user's id, figures out which dashboard root they belong
 * in (admin / buyer / vendor-fabrication / vendor-raw_material). Shared by
 * the login action and by anywhere that needs to bounce an already
 * authenticated visitor straight to their dashboard instead of showing a
 * login/register form again.
 */
export async function getDashboardPath(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "admin") return "/admin";

  if (profile?.role === "vendor") {
    const { data: vendorProfile } = await supabase
      .from("vendor_profiles")
      .select("vendor_type")
      .eq("id", userId)
      .single();
    return `/vendor/${vendorProfile?.vendor_type ?? "fabrication"}`;
  }

  return "/buyer";
}
