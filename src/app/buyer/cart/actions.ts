"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface CartActionState {
  error?: string;
}

export async function removeCartLineAction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (id) await supabase.from("rm_cart_items").delete().eq("id", id);
  revalidatePath("/buyer/cart");
  revalidatePath("/raw-materials", "layout");
}

export async function updateCartLineAction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const quantity = Number(formData.get("quantity"));
  const mtc = formData.get("mtc") === "on";
  if (id && quantity > 0 && Number.isFinite(quantity)) {
    await supabase.from("rm_cart_items").update({ quantity, mtc }).eq("id", id);
  }
  revalidatePath("/buyer/cart");
}

export async function placeRmOrderAction(_prev: CartActionState, formData: FormData): Promise<CartActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/buyer/cart");

  const addressId = String(formData.get("delivery_address_id") ?? "");
  const gstin = String(formData.get("billing_gstin") ?? "").trim();
  if (!addressId) return { error: "Choose a delivery address." };

  const { data: orderId, error } = await supabase.rpc("rm_place_order", {
    p_address_id: addressId,
    p_billing_gstin: gstin || null,
  });
  if (error || !orderId) return { error: error?.message ?? "Could not place the order. Please try again." };

  revalidatePath("/buyer/cart");
  revalidatePath("/buyer/orders");
  revalidatePath("/raw-materials", "layout");
  redirect(`/buyer/orders/${orderId}?placed=1`);
}
