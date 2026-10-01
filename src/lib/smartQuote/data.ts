import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { GradeRate, PricingSettings } from "./pricing";

/** Machining grades with their current base ₹/kg (from the raw-material rate card). */
export async function loadGradeRates(): Promise<GradeRate[]> {
  const supabase = await createClient();
  const [{ data: materials }, { data: grades }, { data: rates }] = await Promise.all([
    supabase.from("rm_materials").select("id, slug, name, density, sort_order").eq("active", true),
    supabase.from("rm_grades").select("id, material_id, name, density, sort_order").eq("active", true),
    supabase.from("rm_rates").select("grade_id, rate_per_kg").is("shape_id", null),
  ]);
  const mat = new Map((materials ?? []).map((m) => [m.id, m]));
  const rate = new Map((rates ?? []).map((r) => [r.grade_id, Number(r.rate_per_kg)]));

  return (grades ?? [])
    .filter((g) => mat.has(g.material_id) && rate.has(g.id))
    .map((g) => {
      const m = mat.get(g.material_id)!;
      return {
        id: g.id,
        name: g.name,
        material_slug: m.slug,
        material_name: m.name,
        density: Number(g.density ?? m.density),
        rate_per_kg: rate.get(g.id)!,
        _sort: [m.sort_order ?? 0, g.sort_order ?? 0] as [number, number],
      };
    })
    .sort((a, b) => a._sort[0] - b._sort[0] || a._sort[1] - b._sort[1] || a.name.localeCompare(b.name))
    .map(({ _sort, ...g }) => {
      void _sort;
      return g;
    });
}

export async function loadPricingSettings(): Promise<PricingSettings | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("sq_settings").select("config").eq("id", 1).maybeSingle();
  return (data?.config as unknown as PricingSettings) ?? null;
}
