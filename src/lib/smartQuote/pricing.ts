/**
 * Smart Quote v1 — CNC price estimate.
 *
 * Pure functions, shared by the quote page (live prices as the buyer changes
 * options) and the server (recomputes on submit; the client's numbers are
 * never trusted). Every rate comes from sq_settings and is editable in
 * Admin → Smart Quote rates.
 *
 * Model (per part):
 *   material  = stock weight × ₹/kg (raw-material rate card) × (1 + scrap)
 *   machining = cycle minutes × machine ₹/hr
 *     cycle   = (rough + finish + features) × tolerance × roughness + handling
 *     rough   = removed volume ÷ material removal rate
 *     finish  = surface area ÷ finishing rate
 *     features= Σ group minutes × √material factor (capped; "candidate"
 *               detections weighted down)
 *   + surface finish, inserts, marking
 * Per order: setups + programming (spread over quantity), inspection,
 * certificates, finishing lot charge. Then margin, tier multiplier and the
 * minimum order value. GST is extra.
 */

import type { CadAnalysisResult } from "./shared";

// ---------------------------------------------------------------- types

export type FeatureGroup =
  | "hole"
  | "thread"
  | "pocket"
  | "slot"
  | "boss"
  | "edge"
  | "turning"
  | "thin"
  | "freeform"
  | "cross";

export const FEATURE_GROUPS: FeatureGroup[] = [
  "hole", "thread", "pocket", "slot", "boss", "edge", "turning", "thin", "freeform", "cross",
];

export interface PartGeometry {
  bbox_mm: [number, number, number];
  volume_mm3: number;
  area_mm2: number;
  solid_count: number;
  rotational: boolean;
  turn_stock: { diameter_mm: number; length_mm: number } | null;
  /** counts per group, split into firm and "candidate" detections */
  features: Record<FeatureGroup, { firm: number; candidate: number }>;
}

export interface GradeRate {
  id: string;
  name: string;
  material_slug: string;
  material_name: string;
  density: number; // g/cm³
  rate_per_kg: number; // ₹
}

export interface PartConfig {
  quantity: number;
  finish: string;
  tolerance: string;
  roughness: string;
  threads_qty: number;
  inserts_qty: number;
  inspection: string;
  certificates: string[];
  part_marking: string[];
}

export interface Tier {
  key: string;
  label: string;
  days: number;
  multiplier: number;
}

export interface PricingSettings {
  currency: string;
  margin_pct: number;
  min_order_value: number;
  milling_rate_per_hr: number;
  turning_rate_per_hr: number;
  setup_min_per_setup: number;
  programming_min: number;
  handling_min_per_part: number;
  hours_per_day: number;
  machines_in_parallel: number;
  stock_allowance_mm: number;
  scrap_pct: number;
  base_mrr_cm3_per_min: number;
  base_finish_cm2_per_min: number;
  material_time_factor: Record<string, number>;
  feature_minutes: Record<FeatureGroup, number>;
  feature_cap_minutes: Record<FeatureGroup, number>;
  candidate_weight: number;
  tolerance_multiplier: Record<string, number>;
  roughness_multiplier: Record<string, number>;
  thread_min_each: number;
  insert_min_each: number;
  insert_cost_each: number;
  finish_rate_per_dm2: Record<string, number>;
  finish_min_lot: number;
  finish_extra_days: number;
  inspection_fee: Record<string, number>;
  certificate_fee: number;
  marking_fee_per_part: number;
  tiers: Tier[];
}

export interface TierPrice {
  key: string;
  label: string;
  unit_price: number;
  total: number;
  lead_days: number;
  arrives_by: string; // ISO date
}

export interface Estimate {
  version: "sq-pricing-v1";
  computed_at: string;
  route: "turning" | "milling";
  quantity: number;
  grade: { id: string; name: string; material: string; rate_per_kg: number };
  stock: { kind: "round bar" | "block"; dims_mm: number[]; weight_kg: number };
  per_part: {
    material: number;
    machining: number;
    finish: number;
    inserts: number;
    marking: number;
    cycle_min: number;
    breakdown_min: Record<string, number>;
  };
  per_order: { setup_programming: number; inspection: number; certificates: number; finish_lot: number };
  subtotal_before_margin: number;
  margin_pct: number;
  tiers: TierPrice[];
  notes: string[];
}

// ---------------------------------------------------------------- geometry from parser output

function groupFor(type: string, section: number | null): FeatureGroup | null {
  const t = type.toUpperCase();
  if (t.includes("THREAD")) return "thread";
  if (t === "COUNTERSINK" || t.includes("CHAMFER") || t.includes("FILLET") || t.includes("TAPER") || t.includes("STEP"))
    return "edge";
  if (t.includes("CROSS") || t.includes("ANGLED") || t.includes("RADIAL") || section === 16) return "cross";
  if (t.includes("ISLAND")) return "pocket";
  if (section === 8 || t.includes("HOLE") || t === "BORE" || t.includes("COUNTERBORE")) return "hole";
  if (section === 9 || t.includes("POCKET")) return "pocket";
  if (section === 10 || t.includes("SLOT") || t.includes("KEYWAY")) return "slot";
  if (section === 11 || t.includes("BOSS")) return "boss";
  if (section === 12) return "edge";
  if (section === 13) return "turning";
  if (section === 14 || t.includes("THIN") || t.includes("UNDERCUT")) return "thin";
  if (section === 15 || t.includes("FREEFORM")) return "freeform";
  return null;
}

export function geometryFromResult(r: CadAnalysisResult): PartGeometry {
  const features = Object.fromEntries(
    FEATURE_GROUPS.map((g) => [g, { firm: 0, candidate: 0 }])
  ) as PartGeometry["features"];
  let hasOD = false;

  for (const sec of r.feature_sections) {
    for (const f of sec.features) {
      if (f.type === "OD") hasOD = true;
      const g = groupFor(f.type, sec.section);
      if (!g) continue;
      if (f.type.endsWith("_CANDIDATE")) features[g].candidate += 1;
      else features[g].firm += 1;
    }
  }

  const lb = r.summary.local_bbox ?? r.summary.global_bbox;
  const bbox: [number, number, number] = [lb.x_length, lb.y_length, lb.z_length];
  const roundSection = Math.abs(bbox[0] - bbox[1]) / Math.max(bbox[0], bbox[1], 1e-9) < 0.03;
  const t = r.turning?.[0];
  const rotational = hasOD && roundSection && r.summary.solid_count === 1 && !!t;

  return {
    bbox_mm: bbox,
    volume_mm3: r.summary.volume_mm3,
    area_mm2: r.summary.surface_area_mm2,
    solid_count: r.summary.solid_count,
    rotational,
    turn_stock: t ? { diameter_mm: t.stock.stock_diameter_mm, length_mm: t.stock.stock_length_mm } : null,
    features,
  };
}

// ---------------------------------------------------------------- helpers

export function finishKey(finish: string): string | null {
  const f = finish.toLowerCase();
  if (!f || f === "standard") return null;
  if (f.includes("hardcoat") || f.includes("hard anod") || f.includes("ptfe")) return "hard_anodize";
  if (f.includes("anodize")) return "anodize";
  if (f.includes("chem film")) return "chem_film";
  if (f.includes("plating")) return "plating";
  if (f.includes("powder")) return "powder_coat";
  if (f.includes("bead")) return "bead_blast";
  if (f.includes("tumbl")) return "tumbled";
  if (f.includes("harden") || f.includes("temper")) return "heat_treat";
  if (f.includes("electropolish")) return "electropolish";
  if (f.includes("cerakote")) return "cerakote";
  return "other";
}

/** Calendar days from today, skipping Sundays. */
export function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = Math.max(0, Math.round(days));
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) left -= 1;
  }
  return d;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

// ---------------------------------------------------------------- estimate

export function estimatePart(
  geo: PartGeometry,
  grade: GradeRate,
  cfg: PartConfig,
  s: PricingSettings,
  now: Date = new Date()
): Estimate {
  const qty = Math.max(1, Math.floor(cfg.quantity || 1));
  const notes: string[] = [];
  const factor = num(s.material_time_factor[grade.material_slug], 3);
  if (s.material_time_factor[grade.material_slug] === undefined)
    notes.push(`No machining factor for ${grade.material_name}; used 3.`);

  // Stock
  const route: Estimate["route"] = geo.rotational ? "turning" : "milling";
  let stockMm3: number;
  let stock: Estimate["stock"];
  if (route === "turning" && geo.turn_stock) {
    const { diameter_mm: d, length_mm: l } = geo.turn_stock;
    stockMm3 = (Math.PI / 4) * d * d * l;
    stock = { kind: "round bar", dims_mm: [r2(d), r2(l)], weight_kg: 0 };
  } else {
    const a = 2 * s.stock_allowance_mm;
    const [x, y, z] = geo.bbox_mm.map((v) => v + a);
    stockMm3 = x * y * z;
    stock = { kind: "block", dims_mm: [r2(x), r2(y), r2(z)], weight_kg: 0 };
  }
  stockMm3 = Math.max(stockMm3, geo.volume_mm3);
  const weightKg = (stockMm3 / 1000) * grade.density / 1000;
  stock.weight_kg = Math.round(weightKg * 1000) / 1000;
  const material = weightKg * grade.rate_per_kg * (1 + s.scrap_pct / 100);

  // Cycle time
  const removedCm3 = Math.max(0, stockMm3 - geo.volume_mm3) / 1000;
  const roughMin = removedCm3 / (s.base_mrr_cm3_per_min / factor);
  const finishMin = geo.area_mm2 / 100 / (s.base_finish_cm2_per_min / factor);
  const breakdown: Record<string, number> = { rough: roughMin, finish_pass: finishMin };
  let featureMin = 0;
  for (const g of FEATURE_GROUPS) {
    const c = geo.features[g];
    const weighted = c.firm + c.candidate * s.candidate_weight;
    // Hard materials slow cutting a lot (factor), drilling/chamfering less (√factor).
    const m = Math.min(
      weighted * num(s.feature_minutes[g], 0) * Math.sqrt(factor),
      num(s.feature_cap_minutes[g], 60)
    );
    if (m > 0) breakdown[g] = m;
    featureMin += m;
  }
  const threadMin = cfg.threads_qty * s.thread_min_each * Math.sqrt(factor);
  const insertMin = cfg.inserts_qty * s.insert_min_each;
  if (threadMin) breakdown.threads = threadMin;
  if (insertMin) breakdown.inserts = insertMin;

  const tol = num(s.tolerance_multiplier[cfg.tolerance], 1);
  const rough = num(s.roughness_multiplier[cfg.roughness], 1);
  const cycleMin =
    (roughMin + finishMin + featureMin + threadMin) * tol * rough + insertMin + s.handling_min_per_part;
  breakdown.handling = s.handling_min_per_part;

  const ratePerHr = route === "turning" ? s.turning_rate_per_hr : s.milling_rate_per_hr;
  const machining = (cycleMin / 60) * ratePerHr;

  // Per-part extras
  const fKey = finishKey(cfg.finish);
  const finish = fKey ? (geo.area_mm2 / 10_000) * num(s.finish_rate_per_dm2[fKey], 15) : 0;
  const inserts = cfg.inserts_qty * s.insert_cost_each;
  const marking = cfg.part_marking.length * s.marking_fee_per_part;

  // Per-order costs
  const setups =
    (route === "turning" ? 1 : 2) + (geo.features.cross.firm + geo.features.cross.candidate > 0 ? 1 : 0);
  const setupProgramming = ((setups * s.setup_min_per_setup + s.programming_min) / 60) * ratePerHr;
  const inspection = num(s.inspection_fee[cfg.inspection], 0);
  const certificates = cfg.certificates.length * s.certificate_fee;
  const finishLot = fKey ? s.finish_min_lot : 0;

  const perPart = material + machining + finish + inserts + marking;
  const subtotal = qty * perPart + setupProgramming + inspection + certificates + finishLot;
  const withMargin = subtotal * (1 + s.margin_pct / 100);

  const productionDays = Math.ceil(
    (qty * cycleMin) / 60 / Math.max(1, s.hours_per_day) / Math.max(1, num(s.machines_in_parallel, 1))
  );
  const extraDays = Math.max(0, productionDays - 2) + (fKey ? s.finish_extra_days : 0);

  const tiers: TierPrice[] = s.tiers.map((t) => {
    const total = Math.max(s.min_order_value, withMargin * t.multiplier);
    const lead = t.days + extraDays;
    return {
      key: t.key,
      label: t.label,
      total: Math.round(total),
      unit_price: r2(total / qty),
      lead_days: lead,
      arrives_by: addWorkingDays(now, lead).toISOString().slice(0, 10),
    };
  });
  if (tiers.some((t) => t.total === Math.round(s.min_order_value)))
    notes.push(`Minimum order value ₹${s.min_order_value} applies.`);
  if (geo.solid_count > 1) notes.push(`File contains ${geo.solid_count} bodies; priced as one part.`);

  return {
    version: "sq-pricing-v1",
    computed_at: now.toISOString(),
    route,
    quantity: qty,
    grade: { id: grade.id, name: grade.name, material: grade.material_name, rate_per_kg: grade.rate_per_kg },
    stock,
    per_part: {
      material: r2(material),
      machining: r2(machining),
      finish: r2(finish),
      inserts: r2(inserts),
      marking: r2(marking),
      cycle_min: r2(cycleMin),
      breakdown_min: Object.fromEntries(Object.entries(breakdown).map(([k, v]) => [k, r2(v)])),
    },
    per_order: {
      setup_programming: r2(setupProgramming),
      inspection: r2(inspection),
      certificates: r2(certificates),
      finish_lot: r2(finishLot),
    },
    subtotal_before_margin: r2(subtotal),
    margin_pct: s.margin_pct,
    tiers,
    notes,
  };
}

export function formatInr(n: number, digits = 0) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
}
