"use client";

import { useActionState, useState } from "react";
import { updateOrderStatusAction, type OrderStatusState } from "./actions";
import type { Database } from "@/lib/types/database";

type OrderStatus = Database["public"]["Enums"]["order_status"];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  accepted_paid: "in_production",
  in_production: "shipped",
  shipped: "delivered",
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  in_production: "Mark as In Production",
  shipped: "Mark as Shipped",
  delivered: "Mark as Delivered",
};

const initialState: OrderStatusState = {};

export function OrderStatusForm({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const [state, formAction, pending] = useActionState(updateOrderStatusAction, initialState);
  const [trackingNumber, setTrackingNumber] = useState("");

  const nextStatus = NEXT_STATUS[status];
  if (!nextStatus) return null;

  return (
    <form action={formAction} className="mt-4.5 rounded-[10px] border border-grid bg-surface p-5">
      <input type="hidden" name="order_id" value={orderId} />
      {state.error && (
        <div className="mb-3.5 rounded-lg bg-crit-bg px-3.5 py-2.5 text-[13px] font-medium text-[#a12525]">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="mb-3.5 rounded-lg bg-good-bg px-3.5 py-2.5 text-[13px] font-medium text-[#0a6b0a]">
          {state.success}
        </div>
      )}
      {nextStatus === "shipped" && (
        <div className="mb-3.5">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
            Tracking number (optional)
          </label>
          <input
            name="tracking_number"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Courier tracking / AWB number"
            className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand"
          />
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
      >
        {pending ? "Updating…" : NEXT_LABEL[nextStatus]}
      </button>
    </form>
  );
}
