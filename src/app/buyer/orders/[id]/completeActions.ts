"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface CompleteOrderState {
  error?: string;
  done?: boolean;
}

/** Buyer: "Order received & complete" on a dispatched custom-part order. */
export async function receiveAndCompleteAction(
  _prev: CompleteOrderState,
  formData: FormData
): Promise<CompleteOrderState> {
  const orderId = String(formData.get("order_id") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  if (formData.get("confirm_received") !== "on") {
    return { error: "Please confirm you have received and checked the parts." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cp_complete_order", {
    p_order_id: orderId,
    p_note: note || undefined,
  });
  if (error) return { error: error.message };

  revalidatePath(`/buyer/orders/${orderId}`);
  revalidatePath("/buyer/orders");
  revalidatePath("/buyer");
  return { done: true };
}
