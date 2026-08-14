"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/types/database";
import { nextOrderStatus } from "../../badge-utils";

export interface UpdateOrderStatusState {
  error?: string;
}

export async function updateOrderStatusAction(
  _prevState: UpdateOrderStatusState,
  formData: FormData
): Promise<UpdateOrderStatusState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const orderId = formData.get("order_id") as string;
  const nextStatus = formData.get("next_status") as Enums<"order_status">;
  const trackingNumber = (formData.get("tracking_number") as string) || null;

  if (!orderId || !nextStatus) {
    return { error: "Missing order reference." };
  }

  const { data: vendorProfile } = await supabase
    .from("vendor_profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!vendorProfile) redirect("/login");

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, vendor_id, tracking_number")
    .eq("id", orderId)
    .single();

  if (!order || order.vendor_id !== vendorProfile.id) {
    return { error: "Order not found." };
  }

  const allowedNext = nextOrderStatus(order.status);
  if (!allowedNext || allowedNext !== nextStatus) {
    return { error: "That status change is not allowed from the order's current stage." };
  }

  const updatePayload: { status: Enums<"order_status">; tracking_number?: string } = {
    status: nextStatus,
  };
  if (nextStatus === "shipped" && trackingNumber) {
    updatePayload.tracking_number = trackingNumber;
  }

  const { error } = await supabase.from("orders").update(updatePayload).eq("id", orderId);

  if (error) {
    return { error: error.message };
  }

  redirect(`/vendor/fabrication/orders/${orderId}`);
}
