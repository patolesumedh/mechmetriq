"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdminClientConfig } from "@/lib/supabase/admin";
import { GSTIN_RE } from "@/lib/kyc/rules";
import { PAY_METHODS, newPaymentRef, type PayMethod } from "@/lib/payments/testGateway";
import { isGcsCadEnabled, promoteCadFilesToOrderPrefix } from "@/lib/storage/gcs";

export type PayQuoteResult =
  | { ok: true; orderId: string; paymentRef: string; paidAt: string }
  | { ok: false; error: string };

/**
 * Completes the purchase of a confirmed custom-part quote after the TEST-MODE
 * gateway reports success. The amount is never taken from the browser:
 * sq_pay_quote() reads the admin-confirmed price from the RFQ.
 *
 * TODO(payments): with a real gateway, create the gateway order here and call
 * sq_pay_quote from the verified gateway callback/webhook instead.
 */
export async function payQuoteAction(input: {
  rfqId: string;
  addressId: string;
  billingGstin: string;
  method: PayMethod;
}): Promise<PayQuoteResult> {
  if (process.env.PAYMENTS_MODE === "live") {
    return { ok: false, error: "Online payments are not available yet. Please contact our team." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your session has expired. Please log in again." };

  if (!PAY_METHODS.includes(input.method)) return { ok: false, error: "Choose a payment method." };
  if (!input.addressId) return { ok: false, error: "Choose a delivery address." };
  const gstin = (input.billingGstin ?? "").trim().toUpperCase();
  if (gstin && !GSTIN_RE.test(gstin)) {
    return { ok: false, error: "Enter a valid GSTIN (e.g. 22AAAAA0000A1Z5), or leave it blank." };
  }

  const paymentRef = newPaymentRef();
  const { data: orderId, error } = await supabase.rpc("sq_pay_quote", {
    p_rfq_id: input.rfqId,
    p_delivery_address_id: input.addressId,
    p_method: input.method,
    p_gateway_ref: paymentRef,
    p_billing_gstin: gstin || undefined,
  });
  if (error || !orderId) return { ok: false, error: error?.message ?? "Payment could not be recorded." };

  // Preserve ordered CAD files in orders/{orderId}/ so the 90-day uploads/ lifecycle doesn't delete them
  if (isGcsCadEnabled() && hasAdminClientConfig()) {
    try {
      const admin = createAdminClient();
      const { data: rfq } = await admin
        .from("rfqs")
        .select("cad_file_urls")
        .eq("id", input.rfqId)
        .maybeSingle();
      if (rfq?.cad_file_urls?.length) {
        const promoted = await promoteCadFilesToOrderPrefix(orderId, rfq.cad_file_urls);
        await admin.from("rfqs").update({ cad_file_urls: promoted }).eq("id", input.rfqId);
      }
    } catch {
      // Non-fatal: order payment succeeded
    }
  }

  revalidatePath("/buyer/quotes");
  revalidatePath("/buyer/orders");
  revalidatePath("/buyer");
  return { ok: true, orderId, paymentRef, paidAt: new Date().toISOString() };
}
