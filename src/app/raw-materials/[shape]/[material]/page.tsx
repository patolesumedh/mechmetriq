import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  densityOf,
  gradesFor,
  loadCatalog,
  rateFor,
} from "@/lib/rawMaterials/catalog";
import { inr } from "@/lib/rawMaterials/format";
import { Breadcrumbs } from "../../_components/Breadcrumbs";

async function resolve(params: Promise<{ shape: string; material: string }>) {
  const { shape: shapeSlug, material: materialSlug } = await params;
  const cat = await loadCatalog();
  const shape = cat.shapes.find((s) => s.slug === shapeSlug);
  const material = cat.materials.find((m) => m.slug === materialSlug);
  if (!shape || !material) return null;
  const grades = gradesFor(cat, shape, material);
  if (grades.length === 0) return null;
  return { cat, shape, material, grades };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shape: string; material: string }>;
}): Promise<Metadata> {
  const r = await resolve(params);
  if (!r) return {};
  return {
    title: `${r.material.name} ${r.shape.name} — ${r.grades.map((g) => g.name).slice(0, 5).join(", ")} | MECHmetrIQ`,
    description: `Buy ${r.material.name} ${r.shape.name} in ${r.grades.length} grades. Live ₹/kg rates, cut-to-size, MTC and PAN-India delivery.`,
  };
}

export default async function ShapeMaterialPage({
  params,
}: {
  params: Promise<{ shape: string; material: string }>;
}) {
  const r = await resolve(params);
  if (!r) notFound();
  const { cat, shape, material, grades } = r;
  const otherShapes = cat.shapes.filter(
    (s) => s.id !== shape.id && gradesFor(cat, s, material).length > 0
  );

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-8">
      <Breadcrumbs
        items={[
          { label: "Raw materials", href: "/raw-materials" },
          { label: shape.name, href: `/raw-materials/${shape.slug}` },
          { label: material.name },
        ]}
      />
      <h1 className="mb-1.5 text-[28px] font-bold tracking-tight">
        {material.name} {shape.name}
      </h1>
      <p className="mb-7 max-w-[760px] text-[14px] leading-relaxed text-ink-2">{material.description}</p>

      <div className="overflow-x-auto rounded-xl border border-grid">
        <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
          <thead>
            <tr className="bg-plane text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5 font-semibold">Grade</th>
              <th className="px-4 py-2.5 font-semibold">Equivalents</th>
              <th className="px-4 py-2.5 font-semibold">Typical use</th>
              <th className="px-4 py-2.5 text-right font-semibold">Density</th>
              <th className="px-4 py-2.5 text-right font-semibold">Rate</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {grades.map((g) => {
              const rate = rateFor(cat, shape, g);
              const href = `/raw-materials/${shape.slug}/${material.slug}/${g.slug}`;
              return (
                <tr key={g.id} className="border-t border-grid align-top">
                  <td className="px-4 py-3">
                    <Link href={href} className="font-bold text-ink hover:text-brand">
                      {g.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-ink-2">{g.equivalents ?? "—"}</td>
                  <td className="px-4 py-3 text-[12.5px] text-ink-2">{g.applications ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[12.5px] text-ink-2">
                    {densityOf(cat, g)} g/cm³
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold">
                    {rate !== null ? (
                      <>
                        {inr(rate)}
                        <span className="font-normal text-muted">/kg</span>
                      </>
                    ) : (
                      <span className="text-[12.5px] font-normal text-muted">On request</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={href}
                      className="whitespace-nowrap rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-brand-dark"
                    >
                      Configure
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2.5 text-[12px] text-muted">
        Rates per kg excl. GST and freight. HSN {material.hsn_codes[shape.hsn_key] ?? "—"} · GST {material.gst_rate}%.
      </p>

      {otherShapes.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-muted">
            {material.name} is also available as
          </h2>
          <div className="flex flex-wrap gap-2">
            {otherShapes.map((s) => (
              <Link
                key={s.id}
                href={`/raw-materials/${s.slug}/${material.slug}`}
                className="rounded-full border border-grid px-3.5 py-1.5 text-[12.5px] font-semibold text-ink-2 hover:border-brand hover:text-ink"
              >
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
