import type { Metadata } from "next";
import { densityOf, loadCatalog, materialsForShape } from "@/lib/rawMaterials/catalog";
import { Breadcrumbs } from "../_components/Breadcrumbs";
import { WeightCalculator, type CalcMaterial, type CalcShape } from "./WeightCalculator";

export const metadata: Metadata = {
  title: "Metal Weight Calculator — Bars, Sheets, Pipes, Sections | MECHmetrIQ",
  description:
    "Calculate the theoretical weight of steel, stainless steel, aluminium, copper, brass and titanium bars, sheets, pipes, angles and channels using grade-specific densities.",
};

export default async function WeightCalculatorPage() {
  const cat = await loadCatalog();
  const shapes: CalcShape[] = cat.shapes.map((s) => ({
    slug: s.slug,
    name: s.name,
    formula: s.formula,
    sell_by: s.sell_by,
    dims: s.dims,
    std_lengths: s.std_lengths,
    std_sheet_sizes: s.std_sheet_sizes,
    rate_premium_pct: s.rate_premium_pct,
    materialSlugs: materialsForShape(cat, s).map((m) => m.slug),
  }));
  const materials: CalcMaterial[] = cat.materials.map((m) => ({
    slug: m.slug,
    name: m.name,
    density: m.density,
    grades: cat.grades
      .filter((g) => g.material_id === m.id)
      .map((g) => ({ slug: g.slug, name: g.name, density: densityOf(cat, g) })),
  }));

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-8">
      <Breadcrumbs items={[{ label: "Raw materials", href: "/raw-materials" }, { label: "Weight calculator" }]} />
      <h1 className="mb-1.5 text-[28px] font-bold tracking-tight">Metal weight calculator</h1>
      <p className="mb-6 max-w-[720px] text-[14px] text-ink-2">
        The same formulas and grade densities we use to price your order.
      </p>
      <WeightCalculator shapes={shapes} materials={materials} />
    </div>
  );
}
