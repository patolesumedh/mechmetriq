"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPartAnalysis, runCadAnalysis, smartQuoteConfigured } from "@/lib/smartQuote/server";
import { loadGradeRates, loadPricingSettings } from "@/lib/smartQuote/data";
import {
  estimatePart,
  geometryFromResult,
  type PartConfig,
  type PartGeometry,
} from "@/lib/smartQuote/pricing";
import { isStepFile, isStalled, type CadAnalysisResult } from "@/lib/smartQuote/shared";
import {
  CERTIFICATE_OPTIONS,
  FINISH_OPTIONS,
  INSPECTION_OPTIONS,
  PART_MARKING_OPTIONS,
  ROUGHNESS_OPTIONS,
  SUBPROCESS_OPTIONS,
  TOLERANCE_OPTIONS,
} from "@/lib/smartQuote/options";
import type { Json, TablesUpdate } from "@/lib/types/database";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function ownPath(userId: string, path: string) {
  return typeof path === "string" && path.startsWith(`${userId}/`) && !path.includes("..") && path.length < 400;
}

// ------------------------------------------------------------------ analysis

export async function startPartAnalysisAction(
  storagePath: string
): Promise<{ id?: string; error?: string }> {
  const { user } = await requireUser();
  if (!ownPath(user.id, storagePath) || !isStepFile(storagePath)) return { error: "Not a STEP file." };
  if (!smartQuoteConfigured()) return { error: "Instant quoting isn't available right now." };
  try {
    const id = await createPartAnalysis(user.id, storagePath);
    after(() => runCadAnalysis(id));
    return { id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't start the analysis." };
  }
}

export interface PartView {
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | "stalled";
  error: string | null;
  thumbnailUrl: string | null;
  geometry: PartGeometry | null;
  summary: {
    bbox_mm: [number, number, number];
    volume_mm3: number;
    surface_area_mm2: number;
    feature_count: number;
    warnings: string[];
  } | null;
}

export async function getPartAnalysisAction(id: string): Promise<PartView | null> {
  const { supabase, user } = await requireUser();
  const { data: row } = await supabase
    .from("cad_analyses")
    .select("id, buyer_id, status, error, result, thumbnail_path, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.buyer_id !== user.id) return null;

  const stalled = isStalled(row.status, row.updated_at);
  const view: PartView = {
    id: row.id,
    status: stalled ? "stalled" : (row.status as PartView["status"]),
    error: stalled ? "Reading this file took too long." : row.error,
    thumbnailUrl: null,
    geometry: null,
    summary: null,
  };
  if (row.status !== "completed" || !row.result) return view;

  const r = row.result as unknown as CadAnalysisResult;
  view.geometry = geometryFromResult(r);
  const b = r.summary.global_bbox;
  view.summary = {
    bbox_mm: [b.x_length, b.y_length, b.z_length],
    volume_mm3: r.summary.volume_mm3,
    surface_area_mm2: r.summary.surface_area_mm2,
    feature_count: r.feature_count,
    warnings: r.warnings ?? [],
  };
  if (row.thumbnail_path) {
    const { data } = await supabase.storage.from("rfq-attachments").createSignedUrl(row.thumbnail_path, 60 * 60);
    view.thumbnailUrl = data?.signedUrl ?? null;
  }
  return view;
}

// ------------------------------------------------------------------ submit

export interface SubmittedPart {
  storagePath: string;
  analysisId: string | null;
  drawingPaths: string[];
  gradeId: string;
  tier: string;
  config: PartConfig & { subprocess: string; colour_coating: string };
}

export interface SubmitPayload {
  parts: SubmittedPart[];
  deliveryAddressId: string;
  specialInstructions: string;
}

const pick = (v: unknown, allowed: string[], fallback: string) =>
  typeof v === "string" && allowed.includes(v) ? v : fallback;
const pickMany = (v: unknown, allowed: string[]) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && allowed.includes(x)) : [];
const int = (v: unknown, min: number, max: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

export async function submitQuoteAction(payload: SubmitPayload): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!payload?.parts?.length) return { error: "Add at least one part." };
  if (payload.parts.length > 20) return { error: "Up to 20 parts per request." };

  const { data: cnc } = await supabase
    .from("master_items")
    .select("id")
    .eq("type", "process")
    .ilike("name", "cnc machining")
    .maybeSingle();
  if (!cnc) return { error: "CNC Machining isn't set up as a process yet." };

  const [grades, settings] = await Promise.all([loadGradeRates(), loadPricingSettings()]);
  const gradeById = new Map(grades.map((g) => [g.id, g]));
  const admin = createAdminClient();
  const deliveryAddressId =
    typeof payload.deliveryAddressId === "string" && payload.deliveryAddressId ? payload.deliveryAddressId : null;
  const notes = String(payload.specialInstructions ?? "").trim().slice(0, 4000) || null;

  for (const part of payload.parts) {
    if (!ownPath(user.id, part.storagePath)) return { error: "One of the files isn't yours." };
    const drawings = (part.drawingPaths ?? []).filter((p) => ownPath(user.id, p)).slice(0, 10);
    const c = part.config ?? ({} as SubmittedPart["config"]);
    const cfg: PartConfig = {
      quantity: int(c.quantity, 1, 1_000_000),
      finish: pick(c.finish, FINISH_OPTIONS, "Standard"),
      tolerance: pick(c.tolerance, TOLERANCE_OPTIONS, TOLERANCE_OPTIONS[1]),
      roughness: pick(c.roughness, ROUGHNESS_OPTIONS, ROUGHNESS_OPTIONS[0]),
      threads_qty: int(c.threads_qty, 0, 10_000),
      inserts_qty: int(c.inserts_qty, 0, 10_000),
      inspection: pick(c.inspection, INSPECTION_OPTIONS, INSPECTION_OPTIONS[0]),
      certificates: pickMany(c.certificates, CERTIFICATE_OPTIONS),
      part_marking: pickMany(c.part_marking, PART_MARKING_OPTIONS),
    };
    const grade = gradeById.get(part.gradeId) ?? null;

    const { data: rfq, error } = await supabase
      .from("rfqs")
      .insert({
        buyer_id: user.id,
        process_id: cnc.id,
        rm_grade_id: grade?.id ?? null,
        subprocess: pick(c.subprocess, SUBPROCESS_OPTIONS, "No Preference"),
        quantity: cfg.quantity,
        tolerance: cfg.tolerance,
        finish_options: [cfg.finish],
        surface_finish: cfg.finish,
        colour_coating: String(c.colour_coating ?? "").trim().slice(0, 200) || null,
        surface_roughness: cfg.roughness,
        threads_qty: cfg.threads_qty || null,
        inserts_qty: cfg.inserts_qty || null,
        part_marking: cfg.part_marking,
        inspection: cfg.inspection,
        certificates: cfg.certificates,
        delivery_address_id: deliveryAddressId,
        special_instructions: notes,
        cad_file_urls: [part.storagePath, ...drawings],
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !rfq) return { error: error?.message ?? "Couldn't save your request." };

    // Link the analysis and attach the estimate (server-computed only).
    if (part.analysisId && grade && settings) {
      const { data: a } = await admin
        .from("cad_analyses")
        .select("id, buyer_id, rfq_id, status, result, storage_path")
        .eq("id", part.analysisId)
        .maybeSingle();
      if (a && a.buyer_id === user.id && !a.rfq_id && a.storage_path === part.storagePath) {
        await admin.from("cad_analyses").update({ rfq_id: rfq.id }).eq("id", a.id);
        const update: TablesUpdate<"rfqs"> = { analysis_id: a.id };
        if (a.status === "completed" && a.result) {
          const est = estimatePart(
            geometryFromResult(a.result as unknown as CadAnalysisResult),
            grade,
            cfg,
            settings
          );
          const tier = est.tiers.find((t) => t.key === part.tier) ?? est.tiers[1] ?? est.tiers[0];
          Object.assign(update, {
            price_status: "estimated",
            price_tier: tier.key,
            estimate: est as unknown as Json,
            estimated_unit_price: tier.unit_price,
            estimated_total: tier.total,
            estimated_lead_days: tier.lead_days,
            lead_time_pref: tier.label,
          });
        }
        await admin.from("rfqs").update(update).eq("id", rfq.id);
      }
    }
  }

  redirect(`/buyer/quotes?submitted=${payload.parts.length}`);
}
