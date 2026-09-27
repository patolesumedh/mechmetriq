"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/types/database";

export interface RmOrderActionState {
  error?: string;
}

const METHODS: Enums<"payment_method">[] = ["upi", "card", "netbanking"];

/**
 * Records payment for an approved raw-material order.
 * TODO(payments): replace with the gateway flow — create the gateway order
 * here, and call rm_pay_order from the verified gateway webhook instead.
 */
export async function payRmOrderAction(_prev: RmOrderActionState, formData: FormData): Promise<RmOrderActionState> {
  const supabase = await createClient();
  const orderId = String(formData.get("order_id") ?? "");
  const method = String(formData.get("method") ?? "") as Enums<"payment_method">;
  if (!METHODS.includes(method)) return { error: "Choose a payment method." };

  const { error } = await supabase.rpc("rm_pay_order", { p_order_id: orderId, p_method: method });
  if (error) return { error: error.message };
  revalidatePath(`/buyer/orders/${orderId}`);
  revalidatePath("/buyer/orders");
  return {};
}

export async function cancelRmOrderAction(_prev: RmOrderActionState, formData: FormData): Promise<RmOrderActionState> {
  const supabase = await createClient();
  const orderId = String(formData.get("order_id") ?? "");
  const { error } = await supabase.rpc("rm_cancel_order", { p_order_id: orderId });
  if (error) return { error: error.message };
  revalidatePath(`/buyer/orders/${orderId}`);
  revalidatePath("/buyer/orders");
  return {};
}
