"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase;
}

export async function revokeSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const supabase = await requireUser();
  // The RPC only deletes sessions owned by the caller.
  await supabase.rpc("revoke_my_session", { p_session_id: sessionId });
  revalidatePath("/account/security");
  redirect("/account/security?msg=revoked");
}

/** Buyers and vendors may turn two-factor login off; admins may not. */
export async function disableMfaAction() {
  const supabase = await requireUser();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
  if (profile?.role === "admin") redirect("/account/security");

  // Removing a verified factor needs an aal2 session, which anyone with
  // two-factor on already has (getDashboardPath sends them to /mfa/verify).
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  revalidatePath("/account/security");
  redirect("/account/security?msg=mfa_off");
}

export async function signOutOthersAction() {
  const supabase = await requireUser();
  await supabase.auth.signOut({ scope: "others" });
  revalidatePath("/account/security");
  redirect("/account/security?msg=others");
}
