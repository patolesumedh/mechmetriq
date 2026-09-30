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
