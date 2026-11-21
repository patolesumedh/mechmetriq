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
