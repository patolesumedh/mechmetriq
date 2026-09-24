"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { updateKycAction, type OnboardingState } from "./actions";
import type { Tables } from "@/lib/types/database";
import type { KycView } from "@/lib/kyc/server";
import { AddressField, BankFields, ConsentBlock, PanField } from "@/components/kyc/KycFields";

const SECRET_INPUTS = ["pan", "bank_account_number", "bank_account_number_confirm", "ifsc_code"];

const initialState: OnboardingState = {};

const inputClass =
  "w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand";
const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-2";

export function OnboardingForm({
  vendor,
  kyc,
  materials,
}: {
  vendor: Tables<"vendor_profiles">;
  kyc: KycView;
  materials: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateKycAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const fe = state.fieldErrors;

  useEffect(() => {
    if (!state.savedAt || !formRef.current) return;
    for (const n of SECRET_INPUTS) {
      const el = formRef.current.elements.namedItem(n);
      if (el instanceof HTMLInputElement) el.value = "";
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state.savedAt]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  const errText = (k: string) =>
    fe?.[k] ? <p className="mt-1 text-[12px] text-crit">{fe[k]}</p> : null;
  const cls = (k: string) => inputClass + (fe?.[k] ? " border-crit" : "");
  const materialsHandled = new Set(vendor.materials_handled ?? []);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="max-w-[760px]" noValidate>
      {state.error && (
        <div className="mb-4 rounded-lg bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-[#a12525]">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="mb-4 rounded-lg bg-good-bg px-3.5 py-3 text-[13px] font-medium text-[#0a6b0a]">
          {state.success}
        </div>
      )}

      <div className="mb-4.5 rounded-[10px] border border-grid bg-surface p-6">
        <h3 className="mb-1 text-[14.5px] font-semibold">Business Details</h3>
        <p className="mb-4.5 text-[12.5px] text-muted">
          This is used to verify your business and generate GST-compliant invoices.
        </p>

        <div className="mb-3.5">
          <label className={labelClass}>
            Legal business name <span className="text-crit">*</span>
          </label>
          <input
            name="company_name"
            required
            defaultValue={vendor.company_name}
            placeholder="e.g. Apex Alloys Pvt Ltd"
            maxLength={200}
            className={cls("company_name")}
          />
          {errText("company_name")}
        </div>
        <div className="mb-3.5 grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Business type</label>
            <input
              name="business_type"
              defaultValue={vendor.business_type ?? ""}
              placeholder="e.g. Private Limited"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              GSTIN <span className="text-crit">*</span>
            </label>
            <input
              name="gstin"
              required
              defaultValue={vendor.gstin ?? ""}
              placeholder="15-character GSTIN"
              maxLength={15}
              autoComplete="off"
              className={cls("gstin") + " uppercase"}
            />
            {errText("gstin")}
          </div>
        </div>
        <div className="mb-3.5 grid grid-cols-2 gap-3">
          <PanField kyc={kyc} errors={fe} required />
          <div>
            <label className={labelClass}>
              Warehouse / dispatch pincode <span className="text-crit">*</span>
            </label>
            <input
              name="warehouse_pincode"
              required
              defaultValue={vendor.warehouse_pincode ?? ""}
              placeholder="6-digit pincode"
              inputMode="numeric"
              maxLength={6}
              className={cls("warehouse_pincode")}
            />
            {errText("warehouse_pincode")}
          </div>
        </div>
        <AddressField kyc={kyc} errors={fe} />
      </div>

      <div className="mb-4.5 rounded-[10px] border border-grid bg-surface p-6">
        <h3 className="mb-1 text-[14.5px] font-semibold">Materials Supplied</h3>
        <p className="mb-4.5 text-[12.5px] text-muted">
          Select every material you stock — this drives which listings you can create.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {materials.length === 0 && (
            <span className="text-[12.5px] text-muted">No active materials configured yet.</span>
          )}
          {materials.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-1.5 rounded-full border-[1.5px] border-grid px-3.5 py-2 text-[12.5px] font-semibold text-ink-2 has-[:checked]:border-accent-orange has-[:checked]:bg-accent-orange-bg has-[:checked]:text-[#a8461a]"
            >
              <input
                type="checkbox"
                name="materials_handled"
                value={m.id}
                defaultChecked={materialsHandled.has(m.id)}
                className="hidden"
              />
              {m.name}
            </label>
          ))}
        </div>
        <div>
          <label className={labelClass}>Min. order quantity policy</label>
          <input
            name="min_order_policy"
            defaultValue={vendor.min_order_policy ?? ""}
            placeholder="e.g. Set per product, or 10kg minimum across all listings"
            className={inputClass}
          />
        </div>
      </div>

      <div className="mb-4.5 rounded-[10px] border border-grid bg-surface p-6">
        <h3 className="mb-1 text-[14.5px] font-semibold">Bank &amp; Payout Details</h3>
        <p className="mb-4.5 text-[12.5px] text-muted">
          Used to process your marketplace payouts.
        </p>
        <BankFields kyc={kyc} vendorId={vendor.id} errors={fe} />
      </div>

      <ConsentBlock kyc={kyc} errors={fe} />

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-5 py-3 text-[14.5px] font-bold text-white disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : vendor.kyc_status === "draft" || vendor.kyc_status === "rejected"
              ? "Submit for Approval →"
              : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
