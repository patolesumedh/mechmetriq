"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PAY_METHODS, newPaymentRef, type PayMethod } from "@/lib/payments/testGateway";

export interface RmOrderActionState {
  error?: string;
}

export type PayResult =
  | { ok: true; orderId: string; paymentRef: string; paidAt: string }
  | { ok: false; error: string };

/**
 * Records payment for an approved raw-material order after the TEST-MODE
 * gateway reports success. The amount is never taken from the browser:
 * rm_pay_order() charges the order's own total_amount.
 *
 * TODO(payments): with a real gateway, create the gateway order here and call
 * rm_pay_order from the verified gateway callback/webhook instead.
 */
export async function payRmOrderViaGatewayAction(input: {
  orderId: string;
  method: PayMethod;
}): Promise<PayResult> {
  if (process.env.PAYMENTS_MODE === "live") {
    return { ok: false, error: "Online payments are not available yet. Please contact our team." };
  }
  if (!PAY_METHODS.includes(input.method)) return { ok: false, error: "Choose a payment method." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session has expired. Please log in again." };

  const paymentRef = newPaymentRef();
  const { error } = await supabase.rpc("rm_pay_order", {
    p_order_id: input.orderId,
    p_method: input.method,
    p_gateway_ref: paymentRef,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/buyer/orders/${input.orderId}`);
  revalidatePath("/buyer/orders");
  revalidatePath("/buyer");
  return { ok: true, orderId: input.orderId, paymentRef, paidAt: new Date().toISOString() };
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
