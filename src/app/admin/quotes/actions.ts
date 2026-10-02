"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueCadAnalyses, runCadAnalyses, runCadAnalysis } from "@/lib/smartQuote/server";

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

/** Analyse the STEP files of an RFQ that don't have an analysis yet (e.g. RFQs from before v1). */
export async function analyseRfqFilesAction(formData: FormData) {
  const supabase = await requireAdmin();
  const rfqId = String(formData.get("rfq_id") ?? "");
  const { data: rfq } = await supabase
    .from("rfqs")
    .select("id, buyer_id, cad_file_urls")
    .eq("id", rfqId)
    .maybeSingle();
  if (!rfq) redirect("/admin/quotes");

  const ids = await queueCadAnalyses(rfq.id, rfq.buyer_id, rfq.cad_file_urls ?? []);
  if (ids.length > 0) after(() => runCadAnalyses(ids));
  revalidatePath("/admin/quotes");
  redirect("/admin/quotes?analysing=1");
}

/** Run one analysis again (after a failure, a stall, or a parser update). */
export async function rerunAnalysisAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("analysis_id") ?? "");
  const admin = createAdminClient();
  const { data: row } = await admin.from("cad_analyses").select("id").eq("id", id).maybeSingle();
  if (!row) redirect("/admin/quotes");

  await admin
    .from("cad_analyses")
    .update({ status: "pending", error: null, completed_at: null })
    .eq("id", id);
  after(() => runCadAnalysis(id));
  revalidatePath(`/admin/quotes/analysis/${id}`);
  redirect(`/admin/quotes/analysis/${id}`);
}

/** Admin confirms (or corrects) the price shown to the buyer. */
export async function confirmPriceAction(formData: FormData) {
  const supabase = await requireAdmin();
  const rfqId = String(formData.get("rfq_id") ?? "");
  const unit = Number(formData.get("unit_price"));
  const lead = Math.floor(Number(formData.get("lead_days")));
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
  if (!Number.isFinite(unit) || unit <= 0 || unit > 10_000_000 || !Number.isFinite(lead) || lead < 1 || lead > 365) {
    redirect(`/admin/quotes/${rfqId}?error=invalid`);
  }
  const { data: rfq } = await supabase.from("rfqs").select("id, quantity").eq("id", rfqId).maybeSingle();
  if (!rfq) redirect("/admin/quotes");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("rfqs")
    .update({
      price_status: "confirmed",
      confirmed_unit_price: Math.round(unit * 100) / 100,
      confirmed_total: Math.round(unit * rfq.quantity * 100) / 100,
      confirmed_lead_days: lead,
      confirmed_at: new Date().toISOString(),
      confirmed_by: user?.id ?? null,
      price_note: note,
      status: "quoted",
    })
    .eq("id", rfqId);
  if (error) redirect(`/admin/quotes/${rfqId}?error=save`);
  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${rfqId}`);
  redirect(`/admin/quotes/${rfqId}?confirmed=1`);
}
