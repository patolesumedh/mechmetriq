"use client";

import { useActionState, useState } from "react";
import { Card } from "@/components/ui/Card";
import { receiveAndCompleteAction, type CompleteOrderState } from "./completeActions";

/** Shown on a dispatched custom-part order: buyer confirms receipt and closes the order. */
export function ReceiveOrderCard({ orderId, trackingNumber }: { orderId: string; trackingNumber: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(receiveAndCompleteAction, {} as CompleteOrderState);

  return (
    <Card className="mb-6 overflow-hidden border-[#cfe0f5]">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-light/60 px-5 py-4">
        <div>
          <div className="text-[14.5px] font-bold text-ink">Your parts are on the way</div>
          <div className="text-[12.5px] text-ink-2">
            {trackingNumber ? (
              <>
                Tracking <span className="font-mono font-semibold text-ink">{trackingNumber}</span> ·{" "}
              </>
            ) : null}
            Once they arrive and you&rsquo;ve checked them, confirm receipt to complete the order.
          </div>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-[9px] bg-brand px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-brand-dark"
          >
            Order received &amp; complete
          </button>
        )}
      </div>

      {open && (
        <form action={action} className="space-y-3.5 px-5 py-4">
          <input type="hidden" name="order_id" value={orderId} />
          <label className="flex items-start gap-2.5 text-[13px] text-ink">
            <input type="checkbox" name="confirm_received" required className="mt-0.5 accent-[#2a78d6]" />
            <span>
              I have received all the parts in this order and checked them against the specification.
            </span>
          </label>
          <div>
            <label htmlFor="complete-note" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
              Feedback <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea
              id="complete-note"
              name="note"
              rows={2}
              maxLength={1000}
              placeholder="How did the parts turn out?"
              className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand"
            />
          </div>
          <p className="rounded-lg bg-warn-bg px-3 py-2 text-[12px] text-[#7a5600]">
            Completing the order closes it. If anything is missing or out of spec, don&rsquo;t complete it — contact
            our team first.
          </p>
          {state.error && (
            <p role="alert" className="text-[12.5px] font-medium text-[#a12525]">
              {state.error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-[9px] bg-good px-4 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
            >
              {pending ? "Completing…" : "Confirm & complete order"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="rounded-[9px] px-3.5 py-2.5 text-[13px] font-semibold text-ink-2 hover:bg-plane"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Card>
  );
}
