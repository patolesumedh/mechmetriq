import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkPreviewPriceRateLimit } from "@/lib/security/rateLimit";
import { loadGradeRates, loadPricingSettings } from "@/lib/smartQuote/data";
import {
  CERTIFICATE_OPTIONS,
  FINISH_OPTIONS,
  INSPECTION_OPTIONS,
  PART_MARKING_OPTIONS,
  ROUGHNESS_OPTIONS,
  TOLERANCE_OPTIONS,
} from "@/lib/smartQuote/options";
import { estimatePart, geometryFromResult } from "@/lib/smartQuote/pricing";
import type { CadAnalysisResult } from "@/lib/smartQuote/shared";

const PreviewPriceSchema = z.object({
  analysisId: z.string().uuid(),
  gradeId: z.string().uuid(),
  config: z.object({
    quantity: z.number().int().min(1).max(1_000_000),
    finish: z.string().max(120),
    tolerance: z.string().max(120),
    roughness: z.string().max(120),
    threads_qty: z.number().int().min(0).max(10_000),
    inserts_qty: z.number().int().min(0).max(10_000),
    inspection: z.string().max(120),
    certificates: z.array(z.string().max(120)).max(20),
    part_marking: z.array(z.string().max(120)).max(20),
  }),
});

/**
 * Server-side price computation endpoint (`/api/preview-price`).
 * Keeps `estimatePart()` and `sq_settings` pricing multipliers strictly on the
 * server so proprietary pricing formulas never ship to browser bundles.
 */
export async function POST(request: Request) {
  const rl = await checkPreviewPriceRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many price requests. Please wait a moment." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = PreviewPriceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid pricing parameters." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // RLS ensures the user can only access their own analysis row (or admin)
  const { data: row } = await supabase
    .from("cad_analyses")
    .select("id, buyer_id, status, result")
    .eq("id", parsed.data.analysisId)
    .maybeSingle();

  if (!row || row.buyer_id !== user.id || row.status !== "completed" || !row.result) {
    return NextResponse.json({ error: "Analysis not ready." }, { status: 404 });
  }

  const [grades, settings] = await Promise.all([loadGradeRates(), loadPricingSettings()]);
  const grade = grades.find((g) => g.id === parsed.data.gradeId);
  if (!grade || !settings) {
    return NextResponse.json({ error: "Pricing unavailable for selected material." }, { status: 404 });
  }

  const c = parsed.data.config;
  const pick = (v: string, allowed: string[], fallback: string) =>
    allowed.includes(v) ? v : fallback;
  const pickMany = (v: string[], allowed: string[]) => v.filter((x) => allowed.includes(x));

  const geometry = geometryFromResult(row.result as unknown as CadAnalysisResult);
  const estimate = estimatePart(
    geometry,
    grade,
    {
      quantity: c.quantity,
      finish: pick(c.finish, FINISH_OPTIONS, "Standard"),
      tolerance: pick(c.tolerance, TOLERANCE_OPTIONS, TOLERANCE_OPTIONS[1]),
      roughness: pick(c.roughness, ROUGHNESS_OPTIONS, ROUGHNESS_OPTIONS[0]),
      threads_qty: c.threads_qty,
      inserts_qty: c.inserts_qty,
      inspection: pick(c.inspection, INSPECTION_OPTIONS, INSPECTION_OPTIONS[0]),
      certificates: pickMany(c.certificates, CERTIFICATE_OPTIONS),
      part_marking: pickMany(c.part_marking, PART_MARKING_OPTIONS),
    },
    settings
  );

  return NextResponse.json(
    {
      tiers: estimate.tiers,
      notes: estimate.notes,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
