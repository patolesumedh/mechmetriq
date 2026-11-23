"use client";

import { useState } from "react";
import { kg, num } from "@/lib/rawMaterials/format";
import {
  pieceWeightKg,
  usesLength,
  validateDims,
  type ShapeForPricing,
} from "@/lib/rawMaterials/weight";

export interface CalcShape extends ShapeForPricing {
  slug: string;
  materialSlugs: string[];
}
export interface CalcMaterial {
  slug: string;
  name: string;
  density: number;
  grades: { slug: string; name: string; density: number }[];
}

const inputClass =
  "w-full rounded-lg border border-grid bg-surface px-3 py-2.5 text-[13.5px] outline-none focus:border-brand";
const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-2";

export function WeightCalculator({ shapes, materials }: { shapes: CalcShape[]; materials: CalcMaterial[] }) {
  const pieceShapes = shapes.filter((s) => s.sell_by === "piece");
  const [shapeSlug, setShapeSlug] = useState(pieceShapes[0]?.slug ?? "");
  const shape = pieceShapes.find((s) => s.slug === shapeSlug) ?? pieceShapes[0];
  const [materialSlug, setMaterialSlug] = useState(materials[0]?.slug ?? "");
  const material = materials.find((m) => m.slug === materialSlug) ?? materials[0];
  const [gradeSlug, setGradeSlug] = useState("");
  const grade = material?.grades.find((g) => g.slug === gradeSlug);
  const [dimsText, setDimsText] = useState<Record<string, string>>({});
  const [lengthText, setLengthText] = useState("1000");
  const [qtyText, setQtyText] = useState("1");

  const density = grade?.density ?? material?.density ?? 7.85;
  const dims = Object.fromEntries(
    (shape?.dims ?? []).map((d) => [d.key, Number(dimsText[`${shapeSlug}:${d.key}`] ?? d.std?.[3] ?? d.std?.[0] ?? NaN)])
  );
  const length = shape && usesLength(shape.formula) ? Number(lengthText) : null;
  const qty = Math.max(0, Math.floor(Number(qtyText) || 0));
  const problem = shape ? validateDims(shape, dims, length) : "Choose a shape";
  const pw = !problem && shape ? pieceWeightKg(shape.formula, dims, length, density) : null;
  const perMetre =
    !problem && shape && usesLength(shape.formula) ? pieceWeightKg(shape.formula, dims, 1000, density) : null;

  if (!shape || !material) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4 rounded-xl border border-grid p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="wc-shape" className={labelClass}>Shape</label>
            <select id="wc-shape" className={inputClass} value={shape.slug} onChange={(e) => setShapeSlug(e.target.value)}>
              {pieceShapes.map((s) => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wc-material" className={labelClass}>Material</label>
            <select
              id="wc-material"
              className={inputClass}
              value={material.slug}
              onChange={(e) => {
                setMaterialSlug(e.target.value);
                setGradeSlug("");
              }}
            >
              {materials.map((m) => (
                <option key={m.slug} value={m.slug}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wc-grade" className={labelClass}>Grade <span className="font-normal text-muted">(optional)</span></label>
            <select id="wc-grade" className={inputClass} value={gradeSlug} onChange={(e) => setGradeSlug(e.target.value)}>
              <option value="">Typical ({material.density} g/cm³)</option>
              {material.grades.map((g) => (
                <option key={g.slug} value={g.slug}>{g.name} ({g.density} g/cm³)</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {shape.dims.map((d) => {
            const key = `${shapeSlug}:${d.key}`;
            const value = dimsText[key] ?? String(d.std?.[3] ?? d.std?.[0] ?? "");
            return (
              <div key={key}>
                <label htmlFor={`wc-${d.key}`} className={labelClass}>{d.label} ({d.unit})</label>
                {shape.formula === "ismc" ? (
                  <select
                    id={`wc-${d.key}`}
                    className={inputClass}
                    value={value}
                    onChange={(e) => setDimsText({ ...dimsText, [key]: e.target.value })}
                  >
                    {(d.std ?? []).map((v) => (
                      <option key={v} value={v}>ISMC {v}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`wc-${d.key}`}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    className={inputClass}
                    value={value}
                    onChange={(e) => setDimsText({ ...dimsText, [key]: e.target.value })}
                  />
                )}
              </div>
            );
          })}
          {usesLength(shape.formula) && (
            <div>
              <label htmlFor="wc-length" className={labelClass}>Length (mm)</label>
              <input
                id="wc-length"
                type="number"
                inputMode="decimal"
                step="any"
                className={inputClass}
                value={lengthText}
                onChange={(e) => setLengthText(e.target.value)}
              />
            </div>
          )}
          <div>
            <label htmlFor="wc-qty" className={labelClass}>Pieces</label>
            <input
              id="wc-qty"
              type="number"
              min={1}
              step={1}
              className={inputClass}
              value={qtyText}
              onChange={(e) => setQtyText(e.target.value)}
            />
          </div>
        </div>
        {shape.formula === "ismc" && (
          <p className="text-[12px] text-muted">ISMC weights are nominal kg/m from IS 808 and do not depend on the grade.</p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-grid bg-plane p-5" aria-live="polite">
        <div className="text-[12px] font-bold uppercase tracking-wide text-muted">Theoretical weight</div>
        {problem || pw === null ? (
          <p className="text-[13px] font-medium text-[#a12525]">{problem ?? "Enter the dimensions"}</p>
        ) : (
          <>
            <div className="text-[32px] font-extrabold leading-none">{kg(pw * qty)}</div>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-[13px]">
              <dt className="text-ink-2">Per piece</dt>
              <dd className="text-right font-medium">{kg(pw)}</dd>
              {perMetre !== null && shape.formula !== "ismc" && (
                <>
                  <dt className="text-ink-2">Per metre</dt>
                  <dd className="text-right font-medium">{kg(perMetre)}</dd>
                </>
              )}
              <dt className="text-ink-2">Density used</dt>
              <dd className="text-right font-medium">{num(density, 3)} g/cm³</dd>
            </dl>
            <a
              href={
                shape.materialSlugs.includes(material.slug)
                  ? `/raw-materials/${shape.slug}/${material.slug}${grade ? `/${grade.slug}` : ""}`
                  : `/raw-materials/${shape.slug}`
              }
              className="mt-2 rounded-[9px] bg-brand py-2.5 text-center text-[13.5px] font-bold text-white hover:bg-brand-dark"
            >
              Price this on the marketplace &rarr;
            </a>
          </>
        )}
        <p className="text-[11.5px] leading-relaxed text-muted">
          Nominal dimensions; actual mill weight can vary with rolling tolerances.
        </p>
      </div>
    </div>
  );
}
