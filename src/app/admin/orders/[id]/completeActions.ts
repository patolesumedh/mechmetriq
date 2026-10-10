"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface AdminCompleteState {
  error?: string;
  done?: boolean;
}

/** Admin: close a custom-part order (e.g. delivered offline, or buyer confirmed by phone). */
export async function adminCompleteOrderAction(
  _prev: AdminCompleteState,
  formData: FormData
): Promise<AdminCompleteState> {
  const orderId = String(formData.get("order_id") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);

  const supabase = await createClient();
  const { error } = await supabase.rpc("cp_complete_order", {
    p_order_id: orderId,
    p_note: note || undefined,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/buyer/orders/${orderId}`);
  return { done: true };
}
