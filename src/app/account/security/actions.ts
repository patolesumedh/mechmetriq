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

export async function signOutOthersAction() {
  const supabase = await requireUser();
  await supabase.auth.signOut({ scope: "others" });
  revalidatePath("/account/security");
  redirect("/account/security?msg=others");
}
