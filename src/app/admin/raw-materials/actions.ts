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

function refresh() {
  revalidatePath("/admin/raw-materials");
  revalidatePath("/raw-materials", "layout");
  revalidatePath("/"); // homepage teaser shows live rates
}

/** Saves every changed base rate in one material's block. Inputs: rate:<grade_id>. */
export async function saveRatesAction(formData: FormData) {
  const supabase = await requireAdmin();
  const material = String(formData.get("material") ?? "");
  const changes: { grade_id: string; rate: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("rate:")) continue;
    const gradeId = key.slice(5);
    const prev = Number(formData.get(`prev:${gradeId}`));
    const text = String(value).trim();
    if (text === "") continue;
    const rate = Number(text);
    if (!Number.isFinite(rate) || rate <= 0 || rate > 1_000_000) {
      redirect(`/admin/raw-materials?tab=rates&error=invalid_rate#${material}`);
    }
    if (rate !== prev) changes.push({ grade_id: gradeId, rate: Math.round(rate * 100) / 100 });
  }

  for (const c of changes) {
    const { data: existing } = await supabase
      .from("rm_rates")
      .select("id")
      .eq("grade_id", c.grade_id)
      .is("shape_id", null)
      .maybeSingle();
    const res = existing
      ? await supabase.from("rm_rates").update({ rate_per_kg: c.rate }).eq("id", existing.id)
      : await supabase.from("rm_rates").insert({ grade_id: c.grade_id, shape_id: null, rate_per_kg: c.rate });
    if (res.error) redirect(`/admin/raw-materials?tab=rates&error=save_failed#${material}`);
  }
  refresh();
  redirect(`/admin/raw-materials?tab=rates&saved=${changes.length}#${material}`);
}

export async function saveSettingsAction(formData: FormData) {
  const supabase = await requireAdmin();
  const n = (k: string) => Number(String(formData.get(k) ?? "").trim());
  const settings = {
    cut_charge_per_cut: n("cut_charge_per_cut"),
    cut_charge_per_kg: n("cut_charge_per_kg"),
    mtc_fee: n("mtc_fee"),
    min_order_value: n("min_order_value"),
    freight_gst_rate: n("freight_gst_rate"),
  };
  if (Object.values(settings).some((v) => !Number.isFinite(v) || v < 0)) {
    redirect("/admin/raw-materials?tab=settings&error=invalid_settings");
  }
  const tiers: { min_kg: number; pct: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const kgText = String(formData.get(`tier_kg_${i}`) ?? "").trim();
    const pctText = String(formData.get(`tier_pct_${i}`) ?? "").trim();
    if (!kgText && !pctText) continue;
    const minKg = Number(kgText);
    const pct = Number(pctText);
    if (!(minKg > 0) || !(pct > 0) || pct >= 50) {
      redirect("/admin/raw-materials?tab=settings&error=invalid_tier");
    }
    tiers.push({ min_kg: minKg, pct });
  }
  tiers.sort((a, b) => a.min_kg - b.min_kg);

  const { error } = await supabase
    .from("rm_settings")
    .update({ ...settings, bulk_tiers: tiers, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) redirect("/admin/raw-materials?tab=settings&error=save_failed");

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("premium:")) continue;
    const pct = Number(String(value).trim());
    if (!Number.isFinite(pct) || pct < -50 || pct > 200) continue;
    await supabase.from("rm_shapes").update({ rate_premium_pct: pct }).eq("id", key.slice(8));
  }
  refresh();
  redirect("/admin/raw-materials?tab=settings&saved=1");
}

export async function approveRmOrderAction(formData: FormData) {
  const supabase = await requireAdmin();
  const orderId = String(formData.get("order_id") ?? "");
  const vendorId = String(formData.get("vendor_id") ?? "");
  const freight = Number(String(formData.get("freight") ?? "").trim());
  const note = String(formData.get("note") ?? "").trim();
  const { error } = await supabase.rpc("rm_approve_order", {
    p_order_id: orderId,
    p_vendor_id: vendorId,
    p_freight: freight,
    p_note: note || null,
  });
  if (error) redirect(`/admin/orders/${orderId}?rm_error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/raw-materials");
  redirect(`/admin/orders/${orderId}?rm_done=approved`);
}

export async function rejectRmOrderAction(formData: FormData) {
  const supabase = await requireAdmin();
  const orderId = String(formData.get("order_id") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const { error } = await supabase.rpc("rm_reject_order", { p_order_id: orderId, p_note: note });
  if (error) redirect(`/admin/orders/${orderId}?rm_error=${encodeURIComponent(error.message)}`);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/raw-materials");
  redirect(`/admin/orders/${orderId}?rm_done=rejected`);
}
