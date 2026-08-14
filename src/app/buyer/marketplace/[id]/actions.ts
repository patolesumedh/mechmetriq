"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function buyNowAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const listingId = formData.get("listing_id") as string;
  const quantityRaw = Number(formData.get("quantity"));
  if (!listingId) redirect("/buyer/marketplace");

  const { data: listing } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .single();
  if (!listing || listing.status !== "active") redirect("/buyer/marketplace");

  const qty = Math.min(
    Math.max(quantityRaw || listing.min_order_qty, listing.min_order_qty),
    listing.available_stock
  );
  const lineTotal = Math.round(qty * listing.price_per_unit * 100) / 100;

  const { data: order } = await supabase
    .from("orders")
    .insert({
      order_type: "raw_material",
      buyer_id: user.id,
      vendor_id: listing.vendor_id,
      subtotal: lineTotal,
      gst_amount: 0,
      total_amount: lineTotal,
      status: "draft",
    })
    .select("id")
    .single();

  if (!order) redirect("/buyer/marketplace");

  await supabase.from("order_items").insert({
    order_id: order.id,
    listing_id: listing.id,
    description: listing.title,
    quantity: qty,
    unit_price: listing.price_per_unit,
    line_total: lineTotal,
  });

  redirect(`/buyer/checkout/${order.id}`);
}
