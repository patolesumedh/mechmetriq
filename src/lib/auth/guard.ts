import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "./getDashboardPath";

export type AccountArea = "buyer" | "admin" | "fabrication" | "raw_material";

/** Current request path, set by src/proxy.ts. */
export async function currentPathname(): Promise<string> {
  return (await headers()).get("x-pathname") ?? "";
}

/**
 * Lets the request through only if `area` is where this user's status allows
 * them to be (see getDashboardPath); otherwise redirects them there. Vendors
 * whose KYC isn't approved yet may only open their KYC / onboarding pages.
 */
export async function requireAccountFor(area: AccountArea) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const home = await getDashboardPath(supabase, user.id);
  const pathname = await currentPathname();

  let allowed: boolean;
  if (area === "buyer" || area === "admin") {
    allowed = home === `/${area}`;
  } else {
    const root = `/vendor/${area}`;
    const onboarding = `${root}/onboarding`;
    allowed =
      home === root ||
      ((home === onboarding || home === "/account/under-review") &&
        (pathname === onboarding || pathname.startsWith(onboarding + "/")));
  }

  if (!allowed) redirect(home);
  return { supabase, user };
}

/**
 * For admin server actions: an admin role *and* an MFA-verified (aal2)
 * session. Actions that use the service-role client bypass RLS, so they
 * must check this themselves.
 */
export async function requireAdminSession() {
  const { supabase } = await requireAccountFor("admin");
  return supabase;
}
