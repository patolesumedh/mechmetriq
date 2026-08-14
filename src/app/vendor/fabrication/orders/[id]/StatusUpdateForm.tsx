"use client";

import { useActionState } from "react";
import { updateOrderStatusAction, type UpdateOrderStatusState } from "./actions";
import { Button } from "@/components/ui/Button";
import { orderStatusLabel } from "../../badge-utils";
import type { Enums } from "@/lib/types/database";

const inputClass =
  "w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand";
const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-2";

const initialState: UpdateOrderStatusState = {};

export function StatusUpdateForm({
  orderId,
  nextStatus,
}: {
  orderId: string;
  nextStatus: Enums<"order_status">;
}) {
  const [state, formAction, pending] = useActionState(updateOrderStatusAction, initialState);

  return (
    <form action={formAction} className="border-t border-grid p-5">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="next_status" value={nextStatus} />

      {state.error && (
        <div className="mb-3.5 rounded-lg bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-[#a12525]">
          {state.error}
        </div>
      )}

      {nextStatus === "shipped" && (
        <div className="mb-3.5">
          <label className={labelClass}>Tracking number (optional)</label>
          <input name="tracking_number" placeholder="Courier AWB / tracking ID" className={inputClass} />
        </div>
      )}

      <Button type="submit" variant="primary" size="md" disabled={pending} className="w-full">
        {pending ? "Updating…" : `Mark as ${orderStatusLabel(nextStatus)} →`}
      </Button>
    </form>
  );
}
