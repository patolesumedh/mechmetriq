import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fromRate, gradesFor, loadCatalog, materialsForShape } from "@/lib/rawMaterials/catalog";
import { inr } from "@/lib/rawMaterials/format";
import { Breadcrumbs } from "../_components/Breadcrumbs";
import { ShapeIcon } from "../_components/ShapeIcon";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shape: string }>;
}): Promise<Metadata> {
  const { shape: slug } = await params;
  const cat = await loadCatalog();
  const shape = cat.shapes.find((s) => s.slug === slug);
  if (!shape) return {};
  const mats = materialsForShape(cat, shape).map((m) => m.name);
  return {
    title: `Buy ${shape.name} Online — ${mats.slice(0, 4).join(", ")} | MECHmetrIQ`,
    description: `${shape.description} Available in ${mats.join(", ")}. Transparent ₹/kg rates, cut-to-size, MTC.`,
  };
}

export default async function ShapePage({ params }: { params: Promise<{ shape: string }> }) {
  const { shape: slug } = await params;
  const cat = await loadCatalog();
  const shape = cat.shapes.find((s) => s.slug === slug);
  if (!shape) notFound();

  const materials = materialsForShape(cat, shape);
  const sizeHint = shape.dims
    .map((d) => `${d.label} ${d.min ?? ""}–${d.max ?? ""} ${d.unit}`)
    .join(" · ");

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-8">
      <Breadcrumbs items={[{ label: "Raw materials", href: "/raw-materials" }, { label: shape.name }]} />

      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 flex-none items-center justify-center rounded-xl bg-linear-to-br from-[#eef2f6] to-[#e3e8ee] text-brand-dark">
          <ShapeIcon formula={shape.formula} className="h-14 w-14" />
        </div>
        <div>
          <h1 className="mb-1.5 text-[28px] font-bold tracking-tight">{shape.name}</h1>
          <p className="max-w-[720px] text-[14px] leading-relaxed text-ink-2">{shape.description}</p>
          <p className="mt-1.5 text-[12.5px] text-muted">
            {sizeHint}
            {shape.sell_by === "kg" ? " · sold by weight" : ""}
            {shape.std_lengths.length > 0 &&
              ` · stock lengths ${shape.std_lengths.map((l) => `${l / 1000} m`).join(" / ")}, any length cut to size`}
          </p>
        </div>
      </div>

      <h2 className="mb-3.5 text-[13px] font-bold uppercase tracking-wide text-muted">Choose a material</h2>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {materials.map((m) => {
          const grades = gradesFor(cat, shape, m);
          const from = fromRate(cat, shape, grades);
          return (
            <Link
              key={m.id}
              href={`/raw-materials/${shape.slug}/${m.slug}`}
              className="group flex flex-col rounded-xl border border-grid p-4.5 transition-colors hover:border-brand"
            >
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-[15px] font-bold group-hover:text-brand-dark">{m.name}</span>
                {from !== null && (
                  <span className="text-[12.5px] font-bold">
                    from {inr(from)}
                    <span className="font-normal text-muted">/kg</span>
                  </span>
                )}
              </div>
              <p className="mb-3 line-clamp-2 text-[12.5px] leading-snug text-ink-2">{m.description}</p>
              <div className="mt-auto flex flex-wrap gap-1.5">
                {grades.slice(0, 8).map((g) => (
                  <span key={g.id} className="rounded-md bg-plane px-2 py-0.5 text-[11.5px] font-semibold text-ink-2">
                    {g.name}
                  </span>
                ))}
                {grades.length > 8 && (
                  <span className="px-1 py-0.5 text-[11.5px] text-muted">+{grades.length - 8} more</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
