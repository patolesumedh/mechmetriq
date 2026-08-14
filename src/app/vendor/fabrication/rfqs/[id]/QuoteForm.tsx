"use client";

import { useActionState, useMemo, useState } from "react";
import { submitQuoteAction, type SubmitQuoteState } from "./actions";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatINR } from "../../badge-utils";
import type { Tables } from "@/lib/types/database";

const inputClass =
  "w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand";
const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-2";

const initialState: SubmitQuoteState = {};

export function QuoteForm({
  rfqId,
  quantity,
  materialOptions,
  defaultMaterialId,
}: {
  rfqId: string;
  quantity: number;
  materialOptions: Tables<"master_items">[];
  defaultMaterialId: string | null;
}) {
  const [state, formAction, pending] = useActionState(submitQuoteAction, initialState);
  const [unitPrice, setUnitPrice] = useState("");

  const total = useMemo(() => {
    const n = Number(unitPrice);
    if (!unitPrice || Number.isNaN(n)) return 0;
    return n * quantity;
  }, [unitPrice, quantity]);

  return (
    <Card>
      <CardHeader title="Submit Your Quote" />
      <form action={formAction} className="p-5">
        <input type="hidden" name="rfq_id" value={rfqId} />

        {state.error && (
          <div className="mb-4 rounded-lg bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-[#a12525]">
            {state.error}
          </div>
        )}

        <div className="mb-3.5 grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>
              Unit price (₹) <span className="text-crit">*</span>
            </label>
            <input
              name="unit_price"
              type="number"
              min="0"
              step="0.01"
              required
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              Lead time (days) <span className="text-crit">*</span>
            </label>
            <input name="lead_time_days" type="number" min="1" step="1" required className={inputClass} />
          </div>
        </div>

        <div className="mb-3.5">
          <label className={labelClass}>Material confirmed</label>
          <select name="material_confirmed_id" defaultValue={defaultMaterialId ?? ""} className={inputClass}>
            <option value="">Select material</option>
            {materialOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3.5">
          <label className={labelClass}>
            Quote validity <span className="text-crit">*</span>
          </label>
          <input name="validity_date" type="date" required className={inputClass} />
        </div>

        <div className="mb-4.5">
          <label className={labelClass}>Notes for buyer</label>
          <textarea
            name="notes"
            rows={3}
            maxLength={1000}
            placeholder="Anything the buyer should know (max 1000 chars)"
            className={inputClass}
          />
        </div>

        <div className="mb-4.5 flex items-center justify-between rounded-lg bg-brand-light px-4 py-3.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-brand-dark">
            Total price ({quantity} pcs)
          </span>
          <span className="text-xl font-extrabold text-brand-dark">{formatINR(total)}</span>
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
          {pending ? "Submitting…" : "Submit Quote →"}
        </Button>
      </form>
    </Card>
  );
}
