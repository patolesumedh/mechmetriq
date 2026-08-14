"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const GST_RATE = 0.18;

export async function acceptQuoteAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const quoteId = formData.get("quote_id") as string;
  const rfqId = formData.get("rfq_id") as string;
  if (!quoteId || !rfqId) redirect("/buyer/quotes");

  const { data: quote } = await supabase.from("quotes").select("*").eq("id", quoteId).single();
  if (!quote || quote.rfq_id !== rfqId) redirect("/buyer/quotes");

  const { data: rfq } = await supabase.from("rfqs").select("*").eq("id", rfqId).single();
  if (!rfq || rfq.buyer_id !== user.id) redirect("/buyer/quotes");

  // Only allow accepting once.
  if (rfq.status === "accepted") {
    redirect("/buyer/quotes");
  }

  await supabase.from("quotes").update({ status: "won" }).eq("id", quoteId);
  await supabase.from("quotes").update({ status: "lost" }).eq("rfq_id", rfqId).neq("id", quoteId);
  await supabase.from("rfqs").update({ status: "accepted" }).eq("id", rfqId);

  const subtotal = quote.total_price;
  const gstAmount = Math.round(subtotal * GST_RATE * 100) / 100;
  const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100;

  const { data: order } = await supabase
    .from("orders")
    .insert({
      order_type: "custom_part",
      buyer_id: user.id,
      vendor_id: quote.vendor_id,
      source_quote_id: quote.id,
      delivery_address_id: rfq.delivery_address_id,
      subtotal,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      status: "accepted_paid",
    })
    .select("id")
    .single();

  if (order) {
    const lookupIds = [rfq.process_id, rfq.material_id].filter((v): v is string => Boolean(v));
    const { data: masterItems } = await supabase
      .from("master_items")
      .select("id, name")
      .in("id", lookupIds);
    const nameById = new Map((masterItems ?? []).map((m) => [m.id, m.name]));
    const description =
      [nameById.get(rfq.process_id ?? ""), nameById.get(rfq.material_id ?? "")]
        .filter(Boolean)
        .join(" · ") || "Custom manufactured part";

    await supabase.from("order_items").insert({
      order_id: order.id,
      description,
      quantity: rfq.quantity,
      unit_price: quote.unit_price,
      line_total: quote.total_price,
    });
  }

  revalidatePath("/buyer/quotes");
  redirect(order ? `/buyer/orders/${order.id}` : "/buyer/quotes");
}
