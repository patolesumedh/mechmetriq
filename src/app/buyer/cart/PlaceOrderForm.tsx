"use client";

import { useActionState } from "react";
import { placeRmOrderAction, type CartActionState } from "./actions";

export function PlaceOrderForm({
  addresses,
  disabled,
  disabledReason,
}: {
  addresses: { id: string; label: string; full_address: string; pincode: string; is_default: boolean }[];
  disabled: boolean;
  disabledReason?: string;
}) {
  const [state, formAction, pending] = useActionState(placeRmOrderAction, {} as CartActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <fieldset>
        <legend className="mb-1.5 text-[12.5px] font-semibold text-ink-2">Deliver to</legend>
        {addresses.length > 0 ? (
          <div className="flex flex-col gap-2">
            {addresses.map((a, i) => (
              <label
                key={a.id}
                className="flex items-start gap-2.5 rounded-lg border border-grid px-3 py-2.5 text-[12.5px] has-[:checked]:border-brand has-[:checked]:bg-brand-light"
              >
                <input
                  type="radio"
                  name="delivery_address_id"
                  value={a.id}
                  defaultChecked={a.is_default || i === 0}
                  required
                  className="mt-0.5"
                />
                <span>
                  <b className="block text-ink">{a.label}</b>
                  <span className="text-ink-2">
                    {a.full_address} — {a.pincode}
                  </span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] text-ink-2">
            No saved addresses.{" "}
            <a href="/buyer/addresses" className="font-semibold text-brand">
              Add one
            </a>{" "}
            first.
          </p>
        )}
      </fieldset>
      <div>
        <label htmlFor="billing_gstin" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
          Billing GSTIN <span className="font-normal text-muted">(for input tax credit, optional)</span>
        </label>
        <input
          id="billing_gstin"
          name="billing_gstin"
          maxLength={15}
          autoCapitalize="characters"
          placeholder="27ABCDE1234F1Z5"
          className="w-full rounded-lg border border-grid px-3 py-2.5 text-[13.5px] uppercase outline-none focus:border-brand"
        />
      </div>
      {state.error && (
        <p role="alert" className="rounded-lg bg-crit-bg px-3 py-2 text-[12.5px] font-medium text-[#a12525]">
          {state.error}
        </p>
      )}
      {disabled && disabledReason && <p className="text-[12.5px] text-[#8a5a00]">{disabledReason}</p>}
      <button
        type="submit"
        disabled={disabled || pending || addresses.length === 0}
        className="rounded-[9px] bg-brand py-3 text-[14.5px] font-bold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Placing order…" : "Place order & get proforma"}
      </button>
      <p className="text-[11.5px] leading-relaxed text-muted">
        No payment now. We confirm the supplier and freight (usually within one working day), then you pay from the
        order page.
      </p>
    </form>
  );
}
