"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { queueCadAnalyses, runCadAnalyses } from "@/lib/smartQuote/server";

export interface QuoteFormState {
  error?: string;
}

export async function createRfqAction(
  _prevState: QuoteFormState,
  formData: FormData
): Promise<QuoteFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const processId = (formData.get("process_id") as string) || "";
  const materialId = (formData.get("material_id") as string) || "";
  const subprocess = ((formData.get("subprocess") as string) || "").trim() || null;
  const quantity = Number(formData.get("quantity"));
  const tolerance = ((formData.get("tolerance") as string) || "").trim() || null;
  const finishOptions = formData.getAll("finish_options").map((v) => v.toString());
  const colourCoating = ((formData.get("colour_coating") as string) || "").trim() || null;
  const surfaceRoughness = ((formData.get("surface_roughness") as string) || "").trim() || null;
  const threadsQtyRaw = formData.get("threads_qty");
  const threadsQty = threadsQtyRaw ? Number(threadsQtyRaw) || null : null;
  const insertsQtyRaw = formData.get("inserts_qty");
  const insertsQty = insertsQtyRaw ? Number(insertsQtyRaw) || null : null;
  const partMarking = formData.getAll("part_marking").map((v) => v.toString());
  const inspection = ((formData.get("inspection") as string) || "").trim() || null;
  const certificates = formData.getAll("certificates").map((v) => v.toString());
  const leadTimePref = ((formData.get("lead_time_pref") as string) || "").trim() || null;
  const deliveryAddressId = (formData.get("delivery_address_id") as string) || "";
  const specialInstructions =
    ((formData.get("special_instructions") as string) || "").trim() || null;

  if (!processId) {
    return { error: "Please select a manufacturing process." };
  }
  if (!quantity || quantity <= 0) {
    return { error: "Please enter a valid quantity." };
  }

  // Files are uploaded from the browser straight to Storage (server actions
  // and Vercel cap request bodies well below typical CAD file sizes), so the
  // form sends storage paths. Only paths inside the buyer's own folder count.
  const cadFileUrls = formData
    .getAll("cad_paths")
    .map((v) => v.toString())
    .filter((p) => p.startsWith(`${user.id}/`) && !p.includes("..") && p.length < 400)
    .slice(0, 20);

  const { data: rfq, error } = await supabase.from("rfqs").insert({
    buyer_id: user.id,
    process_id: processId,
    material_id: materialId || null,
    subprocess,
    quantity,
    tolerance,
    finish_options: finishOptions,
    surface_finish: finishOptions.length > 0 ? finishOptions.join(", ") : null,
    colour_coating: colourCoating,
    surface_roughness: surfaceRoughness,
    threads_qty: threadsQty,
    inserts_qty: insertsQty,
    part_marking: partMarking,
    inspection,
    certificates,
    lead_time_pref: leadTimePref,
    delivery_address_id: deliveryAddressId || null,
    special_instructions: specialInstructions,
    cad_file_urls: cadFileUrls.length > 0 ? cadFileUrls : null,
    status: "pending",
  }).select("id").single();

  if (error || !rfq) {
    return { error: error?.message ?? "Couldn't save your request." };
  }

  // Smart Quote v1: read every STEP file after the response is sent, so the
  // buyer isn't kept waiting. Results appear on My Quotes.
  const analysisIds = await queueCadAnalyses(rfq.id, user.id, cadFileUrls);
  if (analysisIds.length > 0) {
    after(() => runCadAnalyses(analysisIds));
  }

  redirect("/buyer/quotes");
}
