"use client";

import { useActionState } from "react";
import { cancelRmOrderAction, payRmOrderAction, type RmOrderActionState } from "./rmActions";

export function RmPayForm({ orderId, amountLabel }: { orderId: string; amountLabel: string }) {
  const [state, action, pending] = useActionState(payRmOrderAction, {} as RmOrderActionState);
  return (
    <form action={action} className="flex flex-col gap-2.5">
      <input type="hidden" name="order_id" value={orderId} />
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1.5 text-[12.5px] font-semibold text-ink-2">Pay with</legend>
        {[
          ["upi", "UPI"],
          ["netbanking", "Net banking"],
          ["card", "Card"],
        ].map(([value, label], i) => (
          <label
            key={value}
            className="flex items-center gap-1.5 rounded-lg border border-grid px-3 py-2 text-[12.5px] has-[:checked]:border-brand has-[:checked]:bg-brand-light"
          >
            <input type="radio" name="method" value={value} defaultChecked={i === 0} /> {label}
          </label>
        ))}
      </fieldset>
      {state.error && (
        <p role="alert" className="text-[12.5px] font-medium text-[#a12525]">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-[9px] bg-brand py-3 text-[14.5px] font-bold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Processing…" : `Pay ${amountLabel}`}
      </button>
    </form>
  );
}

export function RmCancelForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(cancelRmOrderAction, {} as RmOrderActionState);
  return (
    <form action={action}>
      <input type="hidden" name="order_id" value={orderId} />
      {state.error && <p className="mb-1 text-[12px] text-[#a12525]">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="text-[12.5px] font-semibold text-[#a12525] hover:underline disabled:opacity-50"
      >
        {pending ? "Cancelling…" : "Cancel this order"}
      </button>
    </form>
  );
}
