import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, hasAdminClientConfig } from "@/lib/supabase/admin";
import { buildSummary, type CadAnalysisResult } from "@/lib/smartQuote/shared";
import type { Json } from "@/lib/types/database";

const REPLAY_WINDOW_SECONDS = 300; // ±5 minutes

const CadCallbackSchema = z.object({
  analysis_id: z.string().uuid(),
  status: z.enum(["completed", "failed"]),
  result: z.record(z.string(), z.unknown()).optional().nullable(),
  error: z.string().max(500).optional().nullable(),
  thumbnail_path: z.string().max(300).optional().nullable(),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/i)
    .optional()
    .nullable(),
  processing_ms: z.number().int().min(0).max(600_000).optional().nullable(),
});

/**
 * Internal callback endpoint invoked by `mechonehub-cad-worker` over regional
 * HTTPS (`*.run.app/api/internal/cad-result`).
 *
 * Security controls:
 * 1. Blocked at Cloudflare Edge (404 in Worker + WAF rule).
 * 2. Constant-time HMAC-SHA256 verification over `${timestamp}.${rawBody}`
 *    using `CAD_CALLBACK_SECRET`.
 * 3. ±300s timestamp replay window check.
 * 4. Strict Zod payload validation + thumbnail path confinement (`derived/{analysis_id}.png`).
 * 5. Idempotent DB update (`WHERE id = ... AND status IN ('pending', 'processing')`)
 *    so duplicate Pub/Sub deliveries are safely ignored.
 */
export async function POST(req: Request) {
  const secret = process.env.CAD_CALLBACK_SECRET;
  if (!secret || !hasAdminClientConfig()) {
    return new NextResponse("Service unconfigured", { status: 503 });
  }

  const tsHeader = req.headers.get("x-cad-timestamp") ?? "";
  const sigHeader = req.headers.get("x-cad-signature") ?? "";
  const ts = Number(tsHeader);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > REPLAY_WINDOW_SECONDS) {
    return new NextResponse("Stale or invalid timestamp", { status: 401 });
  }

  const rawBody = await req.text();
  const expectedHex = createHmac("sha256", secret).update(`${tsHeader}.${rawBody}`).digest("hex");

  const sigBuf = Buffer.from(sigHeader, "utf8");
  const expBuf = Buffer.from(expectedHex, "utf8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const validated = CadCallbackSchema.safeParse(parsedJson);
  if (!validated.success) {
    return new NextResponse("Invalid payload schema", { status: 400 });
  }

  const payload = validated.data;
  const expectedThumbPrefix = `derived/${payload.analysis_id}.png`;
  if (payload.thumbnail_path && payload.thumbnail_path !== expectedThumbPrefix) {
    return new NextResponse("Invalid thumbnail_path", { status: 400 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  if (payload.status === "failed") {
    await admin
      .from("cad_analyses")
      .update({
        status: "failed",
        error: (payload.error || "Could not analyse this STEP file.").slice(0, 500),
        processing_ms: payload.processing_ms ?? null,
        completed_at: nowIso,
      })
      .eq("id", payload.analysis_id)
      .in("status", ["pending", "processing"]);

    return NextResponse.json({ ok: true });
  }

  if (!payload.result) {
    return new NextResponse("Missing result on completed callback", { status: 400 });
  }

  const cadResult = payload.result as unknown as CadAnalysisResult;
  const summary = buildSummary(cadResult);

  await admin
    .from("cad_analyses")
    .update({
      status: "completed",
      error: null,
      result: cadResult as unknown as Json,
      summary: summary as unknown as Json,
      analysis_version: cadResult.analysis_version ?? null,
      processing_ms: payload.processing_ms ?? cadResult.processing_ms ?? null,
      thumbnail_path: payload.thumbnail_path ?? null,
      sha256: payload.sha256 ? payload.sha256.toLowerCase() : undefined,
      sha256_verified: Boolean(payload.sha256),
      completed_at: nowIso,
    })
    .eq("id", payload.analysis_id)
    .in("status", ["pending", "processing"]);

  return NextResponse.json({ ok: true });
}
