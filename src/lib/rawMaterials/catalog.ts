import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types/database";
import {
  effectiveRate,
  type DimSpec,
  type Formula,
  type PricingSettings,
  type ShapeForPricing,
} from "./weight";

export interface RmShape extends ShapeForPricing {
  id: string;
  slug: string;
  family: string;
  hsn_key: string;
  description: string;
  sort_order: number;
}

export interface RmMaterial {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  density: number;
  description: string;
  hsn_codes: Record<string, string>;
  gst_rate: number;
}

export interface RmGrade {
  id: string;
  material_id: string;
  slug: string;
  name: string;
  equivalents: string | null;
  description: string;
  applications: string | null;
  density: number | null;
  mtc_available: boolean;
  shape_slugs: string[] | null;
}

export interface RmCatalog {
  shapes: RmShape[];
  materials: RmMaterial[];
  grades: RmGrade[];
  /** shape id → material ids offered */
  shapeMaterials: Map<string, Set<string>>;
  /** grade id → base ₹/kg */
  baseRates: Map<string, number>;
  /** `${grade}:${shape}` → shape-specific ₹/kg */
  shapeRates: Map<string, number>;
  settings: PricingSettings;
}

export function toShape(row: Tables<"rm_shapes">): RmShape {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    family: row.family,
    hsn_key: row.hsn_key,
    description: row.description,
    sort_order: row.sort_order,
    formula: row.formula as Formula,
    sell_by: row.sell_by as "piece" | "kg",
    dims: (row.dims as unknown as DimSpec[]) ?? [],
    std_lengths: (row.std_lengths ?? []).map(Number),
    std_sheet_sizes: (row.std_sheet_sizes as unknown as [number, number][]) ?? [],
    rate_premium_pct: Number(row.rate_premium_pct),
  };
}

export function toSettings(row: Tables<"rm_settings"> | null): PricingSettings {
  return {
    cut_charge_per_cut: Number(row?.cut_charge_per_cut ?? 50),
    cut_charge_per_kg: Number(row?.cut_charge_per_kg ?? 5),
    mtc_fee: Number(row?.mtc_fee ?? 250),
    min_order_value: Number(row?.min_order_value ?? 2000),
    bulk_tiers: ((row?.bulk_tiers as unknown as { min_kg: number; pct: number }[]) ?? []).map((t) => ({
      min_kg: Number(t.min_kg),
      pct: Number(t.pct),
    })),
  };
}

/** Loads the whole (small) active catalogue in one round of parallel queries. */
export async function loadCatalog(): Promise<RmCatalog> {
  const supabase = await createClient();
  const [shapes, materials, grades, sm, rates, settings] = await Promise.all([
    supabase.from("rm_shapes").select("*").eq("active", true).order("sort_order"),
    supabase.from("rm_materials").select("*").eq("active", true).order("sort_order"),
    supabase.from("rm_grades").select("*").eq("active", true).order("sort_order"),
    supabase.from("rm_shape_materials").select("shape_id, material_id"),
    supabase.from("rm_rates").select("grade_id, shape_id, rate_per_kg"),
    supabase.from("rm_settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  const shapeMaterials = new Map<string, Set<string>>();
  for (const row of sm.data ?? []) {
    if (!shapeMaterials.has(row.shape_id)) shapeMaterials.set(row.shape_id, new Set());
    shapeMaterials.get(row.shape_id)!.add(row.material_id);
  }
  const baseRates = new Map<string, number>();
  const shapeRates = new Map<string, number>();
  for (const r of rates.data ?? []) {
    if (r.shape_id) shapeRates.set(`${r.grade_id}:${r.shape_id}`, Number(r.rate_per_kg));
    else baseRates.set(r.grade_id, Number(r.rate_per_kg));
  }

  return {
    shapes: (shapes.data ?? []).map(toShape),
    materials: (materials.data ?? []).map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      short_name: m.short_name,
      density: Number(m.density),
      description: m.description,
      hsn_codes: (m.hsn_codes as Record<string, string>) ?? {},
      gst_rate: Number(m.gst_rate),
    })),
    grades: (grades.data ?? []).map((g) => ({
      id: g.id,
      material_id: g.material_id,
      slug: g.slug,
      name: g.name,
      equivalents: g.equivalents,
      description: g.description,
      applications: g.applications,
      density: g.density === null ? null : Number(g.density),
      mtc_available: g.mtc_available,
      shape_slugs: g.shape_slugs,
    })),
    shapeMaterials,
    baseRates,
    shapeRates,
    settings: toSettings(settings.data),
  };
}

/** Materials offered in a shape that have at least one grade for it. */
export function materialsForShape(cat: RmCatalog, shape: RmShape): RmMaterial[] {
  const offered = cat.shapeMaterials.get(shape.id) ?? new Set<string>();
  return cat.materials.filter(
    (m) => offered.has(m.id) && gradesFor(cat, shape, m).length > 0
  );
}

/**
 * Grades of THIS material that are produced in this shape. Grades are
 * matched on material_id (never on name), so a grade can only ever appear
 * under its own material.
 */
export function gradesFor(cat: RmCatalog, shape: RmShape, material: RmMaterial): RmGrade[] {
  if (!(cat.shapeMaterials.get(shape.id)?.has(material.id) ?? false)) return [];
  return cat.grades.filter(
    (g) =>
      g.material_id === material.id && (g.shape_slugs === null || g.shape_slugs.includes(shape.slug))
  );
}

export function rateFor(cat: RmCatalog, shape: RmShape, grade: RmGrade): number | null {
  return effectiveRate(
    cat.baseRates.get(grade.id) ?? null,
    cat.shapeRates.get(`${grade.id}:${shape.id}`) ?? null,
    shape.rate_premium_pct
  );
}

/** Lowest ₹/kg across the given grades in a shape, for "from ₹x/kg" labels. */
export function fromRate(cat: RmCatalog, shape: RmShape, grades: RmGrade[]): number | null {
  const rates = grades.map((g) => rateFor(cat, shape, g)).filter((r): r is number => r !== null);
  return rates.length ? Math.min(...rates) : null;
}

export function densityOf(cat: RmCatalog, grade: RmGrade): number {
  return grade.density ?? cat.materials.find((m) => m.id === grade.material_id)?.density ?? 7.85;
}

/** Shapes that offer this material (for "also available as" links). */
export function shapesForMaterialGrade(cat: RmCatalog, material: RmMaterial, grade?: RmGrade): RmShape[] {
  return cat.shapes.filter(
    (s) =>
      (cat.shapeMaterials.get(s.id)?.has(material.id) ?? false) &&
      (!grade || grade.shape_slugs === null || grade.shape_slugs.includes(s.slug))
  );
}
