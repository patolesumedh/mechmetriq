"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/guard";

/** Suspend (ends all their sessions) or reactivate a user account. */
export async function setAccountStatusAction(formData: FormData) {
  const supabase = await requireAdminSession();
  const userId = String(formData.get("userId") ?? "");
  const status = formData.get("status") === "suspended" ? "suspended" : "active";
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);

  const { error } = await supabase.rpc("admin_set_account_status", {
    p_user_id: userId,
    p_status: status,
    p_reason: reason || undefined,
  });

  revalidatePath("/admin/users");
  redirect(`/admin/users?msg=${error ? "error" : status}`);
}
