"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

type OrderStatus = Database["public"]["Enums"]["order_status"];

export interface OrderStatusState {
  error?: string;
  success?: string;
}

// Forward-only fulfilment transitions a raw material vendor can drive.
const FORWARD_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus>> = {
  accepted_paid: "in_production",
  in_production: "shipped",
  shipped: "delivered",
};

export async function updateOrderStatusAction(
  _prevState: OrderStatusState,
  formData: FormData
): Promise<OrderStatusState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const orderId = formData.get("order_id") as string;
  if (!orderId) return { error: "Missing order id." };

  const { data: vendor } = await supabase
    .from("vendor_profiles")
    .select("id")
    .eq("id", user.id)
    .single();
  if (!vendor) return { error: "Vendor profile not found." };

  const { data: order } = await supabase
    .from("orders")
    .select("id,vendor_id,status")
    .eq("id", orderId)
    .single();
  if (!order || order.vendor_id !== vendor.id) {
    return { error: "You do not have permission to update this order." };
  }

  const nextStatus = FORWARD_TRANSITIONS[order.status];
  if (!nextStatus) {
    return { error: `This order cannot be advanced from its current status.` };
  }

  const trackingNumber = (formData.get("tracking_number") as string | null)?.trim();

  const { error } = await supabase
    .from("orders")
    .update(
      nextStatus === "shipped" && trackingNumber
        ? { status: nextStatus, tracking_number: trackingNumber }
        : { status: nextStatus }
    )
    .eq("id", orderId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/vendor/raw_material/orders/${orderId}`);
  revalidatePath("/vendor/raw_material/orders");
  revalidatePath("/vendor/raw_material");

  return { success: `Order marked as ${nextStatus.replace("_", " ")}.` };
}
