import "server-only";
import { createAdminClient, hasAdminClientConfig } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types/database";
import {
  buildSummary,
  fileNameFromPath,
  isStepFile,
  type CadAnalysisResult,
} from "./shared";

const BUCKET = "rfq-attachments";
/** Allow for a cold start on hosts that sleep when idle (~60 s) plus parsing. */
const SERVICE_TIMEOUT_MS = 240_000;

export function smartQuoteConfigured() {
  return Boolean(
    process.env.SMARTQUOTE_API_URL && process.env.SMARTQUOTE_API_KEY && hasAdminClientConfig()
  );
}

/**
 * Create a pending analysis row for every STEP file in `paths`.
 * Returns the ids that need processing (new rows only).
 */
export async function queueCadAnalyses(rfqId: string, buyerId: string, paths: string[]) {
  const stepPaths = paths.filter(isStepFile);
  if (stepPaths.length === 0 || !hasAdminClientConfig()) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cad_analyses")
    .upsert(
      stepPaths.map((p) => ({
        rfq_id: rfqId,
        buyer_id: buyerId,
        storage_path: p,
        file_name: fileNameFromPath(p),
      })),
      { onConflict: "rfq_id,storage_path", ignoreDuplicates: true }
    )
    .select("id");

  if (error) {
    console.error("[smartquote] queue failed", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.id);
}

async function readServiceError(res: Response) {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    /* not JSON */
  }
  return `Analysis service returned HTTP ${res.status}.`;
}

/**
 * Download the STEP file, send it to the parser service and store the result.
 * Never throws: failures are written to the row so the UI can show them.
 */
export async function runCadAnalysis(analysisId: string) {
  if (!hasAdminClientConfig()) {
    console.error("[smartquote] SUPABASE_SERVICE_ROLE_KEY missing; cannot run analysis");
    return;
  }
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("cad_analyses")
    .select("id, buyer_id, storage_path, file_name, attempts")
    .eq("id", analysisId)
    .maybeSingle();
  if (!row) return;

  const fail = async (message: string) => {
    await admin
      .from("cad_analyses")
      .update({ status: "failed", error: message.slice(0, 500), completed_at: new Date().toISOString() })
      .eq("id", analysisId);
  };

  const url = process.env.SMARTQUOTE_API_URL;
  const key = process.env.SMARTQUOTE_API_KEY;
  if (!url || !key) {
    await fail("The analysis service isn't configured yet (SMARTQUOTE_API_URL / SMARTQUOTE_API_KEY).");
    return;
  }

  await admin
    .from("cad_analyses")
    .update({ status: "processing", error: null, attempts: (row.attempts ?? 0) + 1 })
    .eq("id", analysisId);

  const { data: blob, error: dlError } = await admin.storage.from(BUCKET).download(row.storage_path);
  if (dlError || !blob) {
    await fail(`Couldn't read the uploaded file: ${dlError?.message ?? "not found"}.`);
    return;
  }

  let res: Response;
  try {
    const form = new FormData();
    form.append("file", blob, row.file_name);
    res = await fetch(`${url.replace(/\/+$/, "")}/analyze`, {
      method: "POST",
      headers: { "X-API-Key": key },
      body: form,
      signal: AbortSignal.timeout(SERVICE_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    await fail(
      timedOut
        ? "The analysis service didn't respond in time. Try again in a minute."
        : "The analysis service couldn't be reached."
    );
    return;
  }

  if (!res.ok) {
    await fail(await readServiceError(res));
    return;
  }

  let result: CadAnalysisResult & { thumbnail_png_base64?: string | null };
  try {
    result = (await res.json()) as typeof result;
  } catch {
    await fail("The analysis service returned an unreadable response.");
    return;
  }

  // Part preview: store the PNG next to the buyer's files, not in the JSON.
  let thumbnailPath: string | null = null;
  const png = result.thumbnail_png_base64;
  delete result.thumbnail_png_base64;
  if (png) {
    const path = `${row.buyer_id}/thumbs/${analysisId}.png`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(png, "base64"), { contentType: "image/png", upsert: true });
    if (upErr) console.error("[smartquote] thumbnail upload failed", upErr.message);
    else thumbnailPath = path;
  }

  const { error: saveError } = await admin
    .from("cad_analyses")
    .update({
      status: "completed",
      error: null,
      result: result as unknown as Json,
      summary: buildSummary(result) as unknown as Json,
      analysis_version: result.analysis_version ?? null,
      processing_ms: result.processing_ms ?? null,
      thumbnail_path: thumbnailPath,
      completed_at: new Date().toISOString(),
    })
    .eq("id", analysisId);

  if (saveError) {
    console.error("[smartquote] save failed", saveError.message);
    await fail("The result couldn't be saved.");
  }
}

/** Run several analyses one after another (keeps load on the service low). */
export async function runCadAnalyses(ids: string[]) {
  for (const id of ids) {
    await runCadAnalysis(id);
  }
}

/**
 * Analyse a STEP file the buyer has just uploaded, before any RFQ exists.
 * Returns the analysis id; the work continues in the background.
 */
export async function createPartAnalysis(buyerId: string, storagePath: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cad_analyses")
    .insert({
      rfq_id: null,
      buyer_id: buyerId,
      storage_path: storagePath,
      file_name: fileNameFromPath(storagePath),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Couldn't start the analysis.");
  return data.id;
}
