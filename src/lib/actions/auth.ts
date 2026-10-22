"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LAST_SEEN_COOKIE, REMEMBER_COOKIE } from "@/lib/auth/sessionPolicy";

export async function logoutAction() {
  const supabase = await createClient();
  // "local" ends only this device's session; other devices stay signed in
  // (they can be revoked from Account security).
  await supabase.auth.signOut({ scope: "local" });
  const cookieStore = await cookies();
  cookieStore.delete(LAST_SEEN_COOKIE);
  cookieStore.delete(REMEMBER_COOKIE);
  // Land on the public homepage after signing out, not the login form.
  redirect("/");
}
