"use client";

import { useActionState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { adminCompleteOrderAction, type AdminCompleteState } from "./completeActions";

export function CompleteOrderCard({ orderId, dispatched }: { orderId: string; dispatched: boolean }) {
  const [state, action, pending] = useActionState(adminCompleteOrderAction, {} as AdminCompleteState);
  return (
    <Card>
      <CardHeader title="Complete order" />
      <form action={action} className="space-y-3 p-5 text-[13px]">
        <input type="hidden" name="order_id" value={orderId} />
        <p className="text-ink-2">
          {dispatched
            ? "The vendor has dispatched this order. Mark it complete once the buyer has the parts — the buyer can also do this themselves."
            : "This order hasn’t been dispatched yet. Only complete it if it was fulfilled outside the platform, and say why."}
        </p>
        <div>
          <label htmlFor="admin-complete-note" className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
            Note {dispatched ? "(optional)" : "(required)"}
          </label>
          <textarea
            id="admin-complete-note"
            name="note"
            rows={2}
            maxLength={1000}
            required={!dispatched}
            placeholder={dispatched ? "e.g. Buyer confirmed receipt by phone" : "e.g. Delivered by hand on 12 Oct"}
            className="w-full rounded-lg border border-grid px-3 py-2 text-[13px] outline-none focus:border-brand"
          />
        </div>
        {state.error && <p className="text-[12.5px] font-medium text-[#a12525]">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-good py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
        >
          {pending ? "Completing…" : "Mark order complete"}
        </button>
      </form>
    </Card>
  );
}
