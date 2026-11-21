/**
 * Client-safe types and currency formatting for Smart Quote pricing.
 *
 * Proprietary pricing formulas (`estimatePart`, rate multipliers, cycle-time
 * equations) live in `src/lib/smartQuote/pricing.ts` which is marked `server-only`
 * and never bundled into client JavaScript.
 */

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

export interface PartGeometry {
  bbox_mm: [number, number, number];
  volume_mm3: number;
  area_mm2: number;
  solid_count: number;
  rotational: boolean;
  turn_stock: { diameter_mm: number; length_mm: number } | null;
  features: Record<FeatureGroup, { firm: number; candidate: number }>;
}

/** Public grade option passed to the browser (excludes base ₹/kg rate if desired, or includes display fields). */
export interface GradeOption {
  id: string;
  name: string;
  material_slug: string;
  material_name: string;
}

export interface GradeRate extends GradeOption {
  density: number; // g/cm³
  rate_per_kg: number; // ₹
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

export interface TierPrice {
  key: string;
  label: string;
  unit_price: number;
  total: number;
  lead_days: number;
  arrives_by: string;
}

export interface PreviewPriceResponse {
  tiers: TierPrice[];
  notes: string[];
}

export function formatInr(n: number, digits = 0) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
}
