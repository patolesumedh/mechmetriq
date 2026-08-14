"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const GST_RATE = 0.18;

export async function placeOrderAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orderId = formData.get("order_id") as string;
  const deliveryAddressId = (formData.get("delivery_address_id") as string) || "";
  const couponCode = ((formData.get("coupon_code") as string) || "").trim();

  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (!order || order.buyer_id !== user.id) redirect("/buyer/orders");
  if (order.status !== "draft") redirect(`/buyer/orders/${orderId}`);

  if (!deliveryAddressId) {
    redirect(`/buyer/checkout/${orderId}`);
  }

  // Verify the address actually belongs to this buyer.
  const { data: address } = await supabase
    .from("addresses")
    .select("id")
    .eq("id", deliveryAddressId)
    .eq("profile_id", user.id)
    .single();
  if (!address) redirect(`/buyer/checkout/${orderId}`);

  let subtotal = order.subtotal;

  if (couponCode) {
    const { data: coupon } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", couponCode)
      .eq("status", "active")
      .maybeSingle();

    if (
      coupon &&
      (!coupon.expiry || new Date(coupon.expiry) >= new Date()) &&
      (!coupon.min_cart_value || subtotal >= coupon.min_cart_value) &&
      (!coupon.usage_cap || coupon.used_count < coupon.usage_cap)
    ) {
      const discount = coupon.type === "percent" ? subtotal * (coupon.value / 100) : coupon.value;
      subtotal = Math.max(subtotal - discount, 0);
      await supabase
        .from("coupons")
        .update({ used_count: coupon.used_count + 1 })
        .eq("id", coupon.id);
    }
  }

  const gstAmount = Math.round(subtotal * GST_RATE * 100) / 100;
  const totalAmount = Math.round((subtotal + gstAmount + order.shipping_amount) * 100) / 100;

  await supabase
    .from("orders")
    .update({
      delivery_address_id: deliveryAddressId,
      subtotal,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      status: "accepted_paid",
    })
    .eq("id", orderId);

  redirect(`/buyer/orders/${orderId}`);
}
