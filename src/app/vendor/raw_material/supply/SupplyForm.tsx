"use client";

import { useActionState, useMemo, useState } from "react";
import { addSupplyAction, type SupplyState } from "./actions";

export interface SupplyOption {
  shapeId: string;
  shapeName: string;
  materials: { id: string; name: string; grades: { id: string; name: string }[] }[];
}

const inputClass =
  "w-full rounded-lg border border-grid bg-surface px-3 py-2.5 text-[13.5px] outline-none focus:border-brand";
const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-2";

export function SupplyForm({ options, defaultPincode }: { options: SupplyOption[]; defaultPincode: string }) {
  const [state, action, pending] = useActionState(addSupplyAction, {} as SupplyState);
  const [shapeId, setShapeId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const materials = useMemo(() => options.find((o) => o.shapeId === shapeId)?.materials ?? [], [options, shapeId]);
  const grades = useMemo(() => materials.find((m) => m.id === materialId)?.grades ?? [], [materials, materialId]);

  return (
    <form action={action} className="grid gap-4 p-5 lg:grid-cols-2">
      <div>
        <label htmlFor="shape_id" className={labelClass}>Shape</label>
        <select
          id="shape_id"
          name="shape_id"
          required
          className={inputClass}
          value={shapeId}
          onChange={(e) => {
            setShapeId(e.target.value);
            setMaterialId("");
          }}
        >
          <option value="">Choose shape</option>
          {options.map((o) => (
            <option key={o.shapeId} value={o.shapeId}>{o.shapeName}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="material_id" className={labelClass}>Material</label>
        <select
          id="material_id"
          className={inputClass}
          value={materialId}
          disabled={!shapeId}
          onChange={(e) => setMaterialId(e.target.value)}
        >
          <option value="">Choose material</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
      <fieldset className="lg:col-span-2">
        <legend className={labelClass}>Grades you stock or can source</legend>
        {grades.length === 0 ? (
          <p className="text-[12.5px] text-muted">Choose a shape and material to see its grades.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {grades.map((g) => (
              <label
                key={g.id}
                className="flex items-center gap-1.5 rounded-lg border border-grid px-3 py-1.5 text-[12.5px] has-[:checked]:border-brand has-[:checked]:bg-brand-light"
              >
                <input type="checkbox" name="grade_id" value={g.id} /> {g.name}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div>
        <label htmlFor="warehouse_pincode" className={labelClass}>Dispatch pincode</label>
        <input
          id="warehouse_pincode"
          name="warehouse_pincode"
          inputMode="numeric"
          pattern="[1-9][0-9]{5}"
          maxLength={6}
          required
          defaultValue={defaultPincode}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="size_range" className={labelClass}>
          Size range <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id="size_range" name="size_range" maxLength={120} placeholder="e.g. Ø6–150 mm" className={inputClass} />
      </div>
      <div className="flex flex-wrap gap-4 text-[13px] lg:col-span-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="mtc_available" defaultChecked /> Can supply MTC
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="cut_to_size" defaultChecked /> Can cut to size
        </label>
      </div>
      <div className="flex items-center gap-3 lg:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-4 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Add to my supply"}
        </button>
        {state.error && <span role="alert" className="text-[12.5px] text-[#a12525]">{state.error}</span>}
        {state.saved && <span role="status" className="text-[12.5px] text-good">Saved {state.saved} grade(s).</span>}
      </div>
    </form>
  );
}
