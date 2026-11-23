"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { TestPaymentGateway } from "@/components/payments/TestPaymentGateway";
import { cancelRmOrderAction, payRmOrderViaGatewayAction, type RmOrderActionState } from "./rmActions";

export function RmPayForm({
  orderId,
  orderNumber,
  amount,
  amountLabel,
  lineCount,
  contact,
}: {
  orderId: string;
  orderNumber: string;
  amount: number;
  amountLabel: string;
  lineCount: number;
  contact: { email: string; phone: string | null };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 rounded-[9px] bg-brand py-3 text-[14.5px] font-bold text-white hover:bg-brand-dark"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 018 0v4" />
        </svg>
        Pay {amountLabel}
      </button>
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10.5px] font-semibold text-muted">
        {["UPI", "Cards", "Netbanking", "Wallets"].map((m) => (
          <span key={m} className="rounded border border-grid px-1.5 py-0.5">
            {m}
          </span>
        ))}
      </div>
      <p className="text-center text-[11px] text-muted">
        <span className="mr-1 rounded bg-[#fff1c2] px-1.5 py-[1px] text-[9.5px] font-extrabold tracking-wider text-[#6b4d00]">
          TEST MODE
        </span>
        Payments are simulated — no money is charged.
      </p>
      {open && (
        <TestPaymentGateway
          amount={amount}
          description={`Raw material · ${lineCount} item${lineCount === 1 ? "" : "s"}`}
          reference={orderNumber}
          contact={contact}
          authorize={(method) => payRmOrderViaGatewayAction({ orderId, method })}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            router.replace(`/buyer/orders/${orderId}?paid=1`);
            router.refresh();
          }}
        />
      )}
    </div>
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
