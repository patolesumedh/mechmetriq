import type { Metadata } from "next";
import Link from "next/link";
import { fromRate, gradesFor, loadCatalog, materialsForShape } from "@/lib/rawMaterials/catalog";
import { FAMILY_LABELS, FAMILY_ORDER, inr } from "@/lib/rawMaterials/format";
import { QuickFinder, type FinderShape } from "./_components/QuickFinder";
import { ShapeIcon } from "./_components/ShapeIcon";

export const metadata: Metadata = {
  title: "Raw Material Marketplace — Buy Metals Online | MECHmetrIQ",
  description:
    "Buy stainless steel, mild steel, alloy and tool steel, aluminium, copper, brass, bronze, nickel alloys and titanium as bars, sheets, plates, pipes and sections. Transparent ₹/kg rates, cut-to-size, MTC and GST invoicing.",
};

const STEPS = [
  { n: "1", title: "Configure & add to cart", body: "Pick shape, material and grade, enter sizes. Weight and price update as you type." },
  { n: "2", title: "Place order, get a proforma", body: "Your proforma invoice is generated instantly from the day's rate card." },
  { n: "3", title: "We confirm", body: "We assign a verified supplier near you and confirm freight — usually within one working day." },
  { n: "4", title: "Pay & receive", body: "Pay only after approval. Material ships with GST invoice, e-way bill and MTC if requested." },
];

const PROMISES = [
  ["Platform-set rates", "One transparent ₹/kg rate card — no haggling, no calling around for quotes."],
  ["Priced on theoretical weight", "See the weight maths for every line before you order."],
  ["Cut to size", "Any length, or any sheet width × length. Charged at the higher of per-cut or per-kg."],
  ["Mill Test Certificate", "Tick MTC on any line and the supplier ships the batch certificate."],
];

export default async function RawMaterialsHome({
  searchParams,
}: {
  searchParams: Promise<{ material?: string }>;
}) {
  const { material: materialFilter } = await searchParams;
  const cat = await loadCatalog();
  const filterMaterial = cat.materials.find((m) => m.slug === materialFilter) ?? null;

  const finder: FinderShape[] = cat.shapes.map((s) => ({
    slug: s.slug,
    name: s.name,
    materials: materialsForShape(cat, s).map((m) => ({
      slug: m.slug,
      name: m.name,
      grades: gradesFor(cat, s, m).map((g) => ({ slug: g.slug, name: g.name })),
    })),
  }));

  const shapeCards = cat.shapes
    .map((s) => {
      const mats = materialsForShape(cat, s).filter((m) => !filterMaterial || m.id === filterMaterial.id);
      const grades = mats.flatMap((m) => gradesFor(cat, s, m));
      return { shape: s, mats, grades, from: fromRate(cat, s, grades) };
    })
    .filter((c) => c.mats.length > 0);

  const gradeCountByMaterial = new Map<string, number>();
  for (const g of cat.grades) gradeCountByMaterial.set(g.material_id, (gradeCountByMaterial.get(g.material_id) ?? 0) + 1);

  return (
    <>
      <section className="bg-[radial-gradient(700px_320px_at_85%_-10%,var(--color-brand-light),transparent_60%)] px-4 pb-10 pt-12 sm:px-8">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            Raw Material Marketplace
          </div>
          <h1 className="mb-3 max-w-[760px] text-[30px] font-bold leading-tight tracking-tight sm:text-[40px]">
            Buy metal raw material by the kg — cut to size, with MTC
          </h1>
          <p className="mb-7 max-w-[640px] text-[15px] leading-relaxed text-ink-2">
            {cat.shapes.length} shapes, {cat.materials.length} materials and {cat.grades.length} grades on one rate
            card. See the weight and price of every line before you order, get a proforma instantly, and pay only
            after we confirm.
          </p>
          <div className="max-w-[900px]">
            <QuickFinder shapes={finder} />
          </div>
        </div>
      </section>

      <section className="px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted">Shop by material</h2>
            {filterMaterial && (
              <Link href="/raw-materials" className="text-[12.5px] font-semibold text-brand">
                Clear filter &times;
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {cat.materials.map((m) => {
              const active = filterMaterial?.id === m.id;
              return (
                <Link
                  key={m.id}
                  href={active ? "/raw-materials" : `/raw-materials?material=${m.slug}`}
                  aria-pressed={active}
                  className={
                    "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors " +
                    (active
                      ? "border-brand bg-brand-light text-brand-dark"
                      : "border-grid text-ink-2 hover:border-brand hover:text-ink")
                  }
                >
                  {m.name}
                  <span className="ml-1.5 font-normal text-muted">{gradeCountByMaterial.get(m.id) ?? 0}</span>
                </Link>
              );
            })}
          </div>
          {filterMaterial && (
            <p className="mt-3 max-w-[760px] text-[13px] leading-relaxed text-ink-2">{filterMaterial.description}</p>
          )}
        </div>
      </section>

      <section className="px-4 pb-14 sm:px-8">
        <div className="mx-auto max-w-[1180px]">
          {FAMILY_ORDER.map((fam) => {
            const cards = shapeCards.filter((c) => c.shape.family === fam);
            if (cards.length === 0) return null;
            return (
              <div key={fam} className="mt-8">
                <h2 className="mb-3.5 text-[18px] font-bold tracking-tight">{FAMILY_LABELS[fam]}</h2>
                <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                  {cards.map(({ shape, mats, grades, from }) => (
                    <Link
                      key={shape.id}
                      href={
                        filterMaterial
                          ? `/raw-materials/${shape.slug}/${filterMaterial.slug}`
                          : `/raw-materials/${shape.slug}`
                      }
                      className="group flex flex-col rounded-xl border border-grid p-4 transition-colors hover:border-brand"
                    >
                      <div className="mb-3 flex h-[72px] items-center justify-center rounded-lg bg-linear-to-br from-[#eef2f6] to-[#e3e8ee] text-brand-dark">
                        <ShapeIcon formula={shape.formula} className="h-12 w-12" />
                      </div>
                      <div className="mb-1 text-[14.5px] font-bold group-hover:text-brand-dark">{shape.name}</div>
                      <p className="mb-3 line-clamp-2 text-[12.5px] leading-snug text-ink-2">{shape.description}</p>
                      <div className="mt-auto flex items-end justify-between text-[12px] text-muted">
                        <span>
                          {mats.length} material{mats.length === 1 ? "" : "s"} · {grades.length} grade
                          {grades.length === 1 ? "" : "s"}
                        </span>
                        {from !== null && (
                          <span className="text-[12.5px] font-bold text-ink">
                            from {inr(from)}
                            <span className="font-normal text-muted">/kg</span>
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-grid bg-plane px-4 py-14 sm:px-8">
        <div className="mx-auto max-w-[1180px]">
          <h2 className="mb-7 text-[24px] font-bold tracking-tight">How ordering works</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-xl border border-grid bg-surface p-5">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-brand-light text-[13px] font-extrabold text-brand-dark">
                  {s.n}
                </div>
                <div className="mb-1.5 text-[14.5px] font-bold">{s.title}</div>
                <p className="text-[13px] leading-relaxed text-ink-2">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {PROMISES.map(([title, body]) => (
              <div key={title} className="flex gap-3">
                <span className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-good-bg text-[11px] font-bold text-good">
                  ✓
                </span>
                <div>
                  <div className="text-[14px] font-bold">{title}</div>
                  <p className="text-[13px] text-ink-2">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 text-[12px] text-muted">
            Rates are per kg, excluding GST and freight. Minimum order {inr(cat.settings.min_order_value)} before GST.
            {cat.settings.bulk_tiers.length > 0 &&
              ` Bulk discounts from ${cat.settings.bulk_tiers[0].min_kg} kg per order.`}
          </p>
        </div>
      </section>
    </>
  );
}
