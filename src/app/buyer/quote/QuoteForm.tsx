"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createRfqAction, type QuoteFormState } from "./actions";
import type { Tables } from "@/lib/types/database";

const initialState: QuoteFormState = {};

const inputClass =
  "w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand";
const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-2";

export function QuoteForm({
  processes,
  materials,
  addresses,
}: {
  processes: Tables<"master_items">[];
  materials: Tables<"master_items">[];
  addresses: Tables<"addresses">[];
}) {
  const [state, formAction, pending] = useActionState(createRfqAction, initialState);

  return (
    <form
      action={formAction}
      className="max-w-[720px] rounded-[10px] border border-grid bg-surface p-6"
    >
      {state.error && (
        <div className="mb-4 rounded-lg bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-[#a12525]">
          {state.error}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3.5">
        <div>
          <label className={labelClass}>Manufacturing process *</label>
          <select name="process_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Select a process
            </option>
            {processes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Material</label>
          <select name="material_id" defaultValue="" className={inputClass}>
            <option value="">Select a material</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3.5">
        <div>
          <label className={labelClass}>Quantity *</label>
          <input name="quantity" type="number" min={1} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Tolerance</label>
          <input
            name="tolerance"
            type="text"
            placeholder="e.g. ±0.05mm"
            className={inputClass}
          />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3.5">
        <div>
          <label className={labelClass}>Surface finish</label>
          <input
            name="surface_finish"
            type="text"
            placeholder="e.g. Anodized"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Colour / coating</label>
          <input
            name="colour_coating"
            type="text"
            placeholder="e.g. Matte black"
            className={inputClass}
          />
        </div>
      </div>

      <div className="mb-4">
        <label className={labelClass}>Preferred lead time</label>
        <input
          name="lead_time_pref"
          type="text"
          placeholder="e.g. 2 weeks"
          className={inputClass}
        />
      </div>

      <div className="mb-4">
        <label className={labelClass}>Delivery address</label>
        {addresses.length > 0 ? (
          <select name="delivery_address_id" defaultValue="" className={inputClass}>
            <option value="">Select an address</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} — {a.full_address}
              </option>
            ))}
          </select>
        ) : (
          <div className="rounded-lg bg-warn-bg px-3.5 py-3 text-[12.5px] text-[#8a5a00]">
            You have no saved addresses yet.{" "}
            <Link href="/buyer/addresses" className="font-semibold underline">
              Add one first
            </Link>
            , or continue and add it later.
          </div>
        )}
      </div>

      <div className="mb-5">
        <label className={labelClass}>Special instructions</label>
        <textarea name="special_instructions" rows={4} className={inputClass} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-[9px] bg-brand px-5 py-3 text-[14.5px] font-bold text-white disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit RFQ"}
      </button>
    </form>
  );
}
