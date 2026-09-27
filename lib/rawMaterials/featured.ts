import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { effectiveRate, type Formula } from "./weight";

/** Catalogue items shown on the homepage marketplace teaser. */
const FEATURED = [
  { shape: "sheet", material: "aluminium", grade: "al-6061", label: "Al 6061 Sheet" },
  { shape: "round-bar", material: "stainless-steel", grade: "ss-304", label: "SS 304 Round Bar" },
  { shape: "hex-bar", material: "brass", grade: "brass-is-319", label: "Free-cutting Brass Hex Bar" },
  { shape: "plate", material: "mild-steel", grade: "is-2062-e250", label: "MS Plate (IS 2062)" },
] as const;

export interface FeaturedItem {
  href: string;
  label: string;
  materialName: string;
  shapeName: string;
  formula: Formula;
  ratePerKg: number | null;
}

/**
 * Live ₹/kg for the homepage teaser. Uses a cookie-less client (public
 * catalogue data only) so the homepage can stay statically cached; it is
 * refreshed on the page's revalidate interval and when admins save rates.
 * Falls back to links without prices if the catalogue can't be read.
 */
export async function getFeaturedItems(): Promise<FeaturedItem[]> {
  const fallback: FeaturedItem[] = FEATURED.map((f) => ({
    href: `/raw-materials/${f.shape}/${f.material}/${f.grade}`,
    label: f.label,
    materialName: "",
    shapeName: "",
    formula: "round_bar",
    ratePerKg: null,
  }));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return fallback;

  try {
    const supabase = createClient<Database>(url, key, { auth: { persistSession: false } });
    const [shapes, materials, grades] = await Promise.all([
      supabase.from("rm_shapes").select("id, slug, name, formula, rate_premium_pct").in("slug", FEATURED.map((f) => f.shape)),
      supabase.from("rm_materials").select("id, slug, name").in("slug", FEATURED.map((f) => f.material)),
      supabase.from("rm_grades").select("id, slug, material_id").in("slug", FEATURED.map((f) => f.grade)),
    ]);
    const gradeIds = (grades.data ?? []).map((g) => g.id);
    const { data: rates } = gradeIds.length
      ? await supabase.from("rm_rates").select("grade_id, shape_id, rate_per_kg").in("grade_id", gradeIds)
      : { data: [] };

    return FEATURED.map((f, i) => {
      const shape = shapes.data?.find((s) => s.slug === f.shape);
      const material = materials.data?.find((m) => m.slug === f.material);
      const grade = grades.data?.find((g) => g.slug === f.grade && g.material_id === material?.id);
      if (!shape || !material || !grade) return fallback[i];
      const base = rates?.find((r) => r.grade_id === grade.id && r.shape_id === null)?.rate_per_kg ?? null;
      const override = rates?.find((r) => r.grade_id === grade.id && r.shape_id === shape.id)?.rate_per_kg ?? null;
      return {
        href: fallback[i].href,
        label: f.label,
        materialName: material.name,
        shapeName: shape.name,
        formula: shape.formula as Formula,
        ratePerKg: effectiveRate(
          base === null ? null : Number(base),
          override === null ? null : Number(override),
          Number(shape.rate_premium_pct)
        ),
      };
    });
  } catch {
    return fallback;
  }
}
