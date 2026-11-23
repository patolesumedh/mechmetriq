"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export interface FinderShape {
  slug: string;
  name: string;
  materials: { slug: string; name: string; grades: { slug: string; name: string }[] }[];
}

const selectClass =
  "w-full rounded-lg border border-grid bg-surface px-3 py-2.5 text-[13.5px] outline-none focus:border-brand disabled:bg-plane disabled:text-muted";

/** Shape → material → grade picker that jumps straight to the configurator. */
export function QuickFinder({ shapes }: { shapes: FinderShape[] }) {
  const router = useRouter();
  const [shape, setShape] = useState("");
  const [material, setMaterial] = useState("");
  const [grade, setGrade] = useState("");

  const materials = useMemo(() => shapes.find((s) => s.slug === shape)?.materials ?? [], [shapes, shape]);
  const grades = useMemo(() => materials.find((m) => m.slug === material)?.grades ?? [], [materials, material]);

  function go() {
    if (shape && material && grade) router.push(`/raw-materials/${shape}/${material}/${grade}`);
    else if (shape && material) router.push(`/raw-materials/${shape}/${material}`);
    else if (shape) router.push(`/raw-materials/${shape}`);
  }

  return (
    <div className="grid gap-2.5 rounded-xl border border-grid bg-surface p-3 shadow-sm sm:grid-cols-[1fr_1fr_1fr_auto]">
      <label className="sr-only" htmlFor="qf-shape">Shape</label>
      <select
        id="qf-shape"
        className={selectClass}
        value={shape}
        onChange={(e) => {
          setShape(e.target.value);
          setMaterial("");
          setGrade("");
        }}
      >
        <option value="">Shape (e.g. Round Bar)</option>
        {shapes.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.name}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="qf-material">Material</label>
      <select
        id="qf-material"
        className={selectClass}
        value={material}
        disabled={!shape}
        onChange={(e) => {
          setMaterial(e.target.value);
          setGrade("");
        }}
      >
        <option value="">Material</option>
        {materials.map((m) => (
          <option key={m.slug} value={m.slug}>
            {m.name}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="qf-grade">Grade</label>
      <select
        id="qf-grade"
        className={selectClass}
        value={grade}
        disabled={!material}
        onChange={(e) => setGrade(e.target.value)}
      >
        <option value="">Grade</option>
        {grades.map((g) => (
          <option key={g.slug} value={g.slug}>
            {g.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={go}
        disabled={!shape}
        className="rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {grade ? "Configure" : "Browse"} &rarr;
      </button>
    </div>
  );
}
