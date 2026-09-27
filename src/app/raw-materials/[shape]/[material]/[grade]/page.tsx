import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { densityOf, gradesFor, loadCatalog, rateFor } from "@/lib/rawMaterials/catalog";
import { inr } from "@/lib/rawMaterials/format";
import { Breadcrumbs } from "../../../_components/Breadcrumbs";
import { ShapeIcon } from "../../../_components/ShapeIcon";
import { Configurator } from "./Configurator";

type Params = Promise<{ shape: string; material: string; grade: string }>;

async function resolve(params: Params) {
  const { shape: shapeSlug, material: materialSlug, grade: gradeSlug } = await params;
  const cat = await loadCatalog();
  const shape = cat.shapes.find((s) => s.slug === shapeSlug);
  const material = cat.materials.find((m) => m.slug === materialSlug);
  if (!shape || !material) return null;
  // Grade must belong to THIS material and be produced in THIS shape.
  const grade = gradesFor(cat, shape, material).find((g) => g.slug === gradeSlug);
  if (!grade) return null;
  return { cat, shape, material, grade };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const r = await resolve(params);
  if (!r) return {};
  const rate = rateFor(r.cat, r.shape, r.grade);
  return {
    title: `${r.grade.name} ${r.material.name} ${r.shape.name}${rate ? ` — ${inr(rate)}/kg` : ""} | MECHmetrIQ`,
    description: `Buy ${r.grade.name} (${r.grade.equivalents ?? r.material.name}) ${r.shape.name} online. ${r.grade.description} Cut to size, MTC, GST invoice.`,
  };
}

export default async function GradePage({ params }: { params: Params }) {
  const r = await resolve(params);
  if (!r) notFound();
  const { cat, shape, material, grade } = r;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let viewer: "anon" | "buyer" | "other" = "anon";
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    viewer = profile?.role === "buyer" ? "buyer" : "other";
  }

  const rate = rateFor(cat, shape, grade);
  const density = densityOf(cat, grade);
  const path = `/raw-materials/${shape.slug}/${material.slug}/${grade.slug}`;
  const otherShapes = cat.shapes.filter(
    (s) => s.id !== shape.id && gradesFor(cat, s, material).some((g) => g.id === grade.id)
  );
  const siblings = gradesFor(cat, shape, material).filter((g) => g.id !== grade.id);

  const facts: [string, string][] = [
    ["Material", material.name],
    ["Equivalents", grade.equivalents ?? "—"],
    ["Density", `${density} g/cm³`],
    ["HSN code", material.hsn_codes[shape.hsn_key] ?? "—"],
    ["GST", `${material.gst_rate}%`],
    ["MTC", grade.mtc_available ? "Available on request" : "Not available"],
    ["Sold by", shape.sell_by === "kg" ? "Weight (kg)" : "Piece, priced on theoretical weight"],
  ];

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-8">
      <Breadcrumbs
        items={[
          { label: "Raw materials", href: "/raw-materials" },
          { label: shape.name, href: `/raw-materials/${shape.slug}` },
          { label: material.name, href: `/raw-materials/${shape.slug}/${material.slug}` },
          { label: grade.name },
        ]}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_440px]">
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 flex-none items-center justify-center rounded-xl bg-linear-to-br from-[#eef2f6] to-[#e3e8ee] text-brand-dark">
              <ShapeIcon formula={shape.formula} className="h-11 w-11" />
            </div>
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wide text-brand">
                {material.name} · {shape.name}
              </div>
              <h1 className="text-[28px] font-bold leading-tight tracking-tight">{grade.name}</h1>
              {rate !== null && (
                <div className="mt-1 text-[20px] font-extrabold">
                  {inr(rate, true)}
                  <span className="text-[13px] font-medium text-muted"> /kg excl. GST</span>
                </div>
              )}
            </div>
          </div>

          <p className="text-[14px] leading-relaxed text-ink-2">{grade.description}</p>
          {grade.applications && (
            <p className="text-[13.5px] text-ink-2">
              <b className="text-ink">Typical uses: </b>
              {grade.applications}
            </p>
          )}

          <div className="overflow-hidden rounded-xl border border-grid">
            <dl className="divide-y divide-grid text-[13px]">
              {facts.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[140px_1fr] gap-3 px-4 py-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-xl bg-plane p-4 text-[12.5px] leading-relaxed text-ink-2">
            <b className="text-ink">How pricing works.</b> Line price = theoretical weight × {inr(rate ?? 0, true)}/kg.
            Non-stock lengths or sheet sizes add a cutting charge of {inr(cat.settings.cut_charge_per_cut)} per piece or{" "}
            {inr(cat.settings.cut_charge_per_kg)} per kg, whichever is higher. GST and freight are added on the proforma;
            freight is confirmed when we approve your order, before you pay.
          </div>

          {siblings.length > 0 && (
            <div>
              <h2 className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-muted">
                Other {material.name} grades in {shape.name}
              </h2>
              <div className="flex flex-wrap gap-2">
                {siblings.map((g) => (
                  <Link
                    key={g.id}
                    href={`/raw-materials/${shape.slug}/${material.slug}/${g.slug}`}
                    className="rounded-full border border-grid px-3 py-1 text-[12.5px] font-semibold text-ink-2 hover:border-brand hover:text-ink"
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {otherShapes.length > 0 && (
            <div>
              <h2 className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-muted">
                {grade.name} is also available as
              </h2>
              <div className="flex flex-wrap gap-2">
                {otherShapes.map((s) => (
                  <Link
                    key={s.id}
                    href={`/raw-materials/${s.slug}/${material.slug}/${grade.slug}`}
                    className="rounded-full border border-grid px-3 py-1 text-[12.5px] font-semibold text-ink-2 hover:border-brand hover:text-ink"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-24">
          <Configurator
            shapeId={shape.id}
            gradeId={grade.id}
            gradeName={grade.name}
            mtcAvailable={grade.mtc_available}
            shape={{
              name: shape.name,
              formula: shape.formula,
              sell_by: shape.sell_by,
              dims: shape.dims,
              std_lengths: shape.std_lengths,
              std_sheet_sizes: shape.std_sheet_sizes,
              rate_premium_pct: shape.rate_premium_pct,
            }}
            density={density}
            ratePerKg={rate}
            settings={cat.settings}
            viewer={viewer}
            loginHref={`/login?next=${encodeURIComponent(path)}`}
          />
        </div>
      </div>
    </div>
  );
}
