import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";

/** Only lets through users whose status-based landing page is `path`. */
export async function requireLanding(path: "/mfa/setup" | "/mfa/verify") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const next = await getDashboardPath(supabase, user.id);
  if (next !== path) redirect(next);
  return user;
}
