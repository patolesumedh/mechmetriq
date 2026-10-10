"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/login");
  return supabase;
}

/** Assigns (or reassigns) the machining vendor on a paid custom-part order. */
export async function assignCustomPartVendorAction(formData: FormData) {
  const supabase = await requireAdmin();
  const orderId = String(formData.get("order_id") ?? "");
  const vendorId = String(formData.get("vendor_id") ?? "");
  const payout = Number(String(formData.get("payout") ?? "").trim());
  const note = String(formData.get("note") ?? "").trim();

  const back = (q: string) => redirect(`/admin/orders/${orderId}?${q}`);
  if (!vendorId) back(`cp_error=${encodeURIComponent("Choose a vendor")}`);
  if (!Number.isFinite(payout) || payout <= 0) {
    back(`cp_error=${encodeURIComponent("Enter the vendor payout")}`);
  }

  const { error } = await supabase.rpc("cp_assign_vendor", {
    p_order_id: orderId,
    p_vendor_id: vendorId,
    p_payout: Math.round(payout * 100) / 100,
    p_note: note || undefined,
  });
  if (error) back(`cp_error=${encodeURIComponent(error.message)}`);

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  back("cp_done=assigned");
}
