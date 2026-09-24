"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { updateOnboardingAction, type OnboardingState } from "./actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Tables } from "@/lib/types/database";
import type { KycView } from "@/lib/kyc/server";
import { AddressField, BankFields, ConsentBlock, PanField } from "@/components/kyc/KycFields";

const SECRET_INPUTS = ["pan", "bank_account_number", "bank_account_number_confirm", "ifsc_code"];

const inputClass =
  "w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand";
const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-2";

const BUSINESS_TYPES = [
  "Proprietorship",
  "Partnership",
  "Private Limited",
  "LLP",
  "Public Limited",
  "Other",
];

const initialState: OnboardingState = {};

export function OnboardingForm({
  vendorProfile,
  kyc,
  processOptions,
  materialOptions,
}: {
  vendorProfile: Tables<"vendor_profiles">;
  kyc: KycView;
  processOptions: Tables<"master_items">[];
  materialOptions: Tables<"master_items">[];
}) {
  const [state, formAction, pending] = useActionState(updateOnboardingAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const fe = state.fieldErrors;

  // After a successful save, clear the typed PAN / account / IFSC so full
  // values don't linger on screen; the masked "on file" hint replaces them.
  useEffect(() => {
    if (!state.savedAt || !formRef.current) return;
    for (const n of SECRET_INPUTS) {
      const el = formRef.current.elements.namedItem(n);
      if (el instanceof HTMLInputElement) el.value = "";
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [state.savedAt]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Submit without React's automatic form reset, so a validation error
    // doesn't wipe everything the vendor typed.
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }
  const [capabilities, setCapabilities] = useState<string[]>(vendorProfile.capabilities ?? []);
  const [materials, setMaterials] = useState<string[]>(vendorProfile.materials_machined ?? []);

  function toggle(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="max-w-[760px]" noValidate>
      {state.success && !state.error && (
        <div className="mb-5 rounded-lg bg-good-bg px-3.5 py-3 text-[13px] font-medium text-[#0a6b0a]">
          {state.success}
        </div>
      )}
      {state.error && (
        <div className="mb-5 rounded-lg bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-[#a12525]">
          {state.error}
        </div>
      )}

      <Card className="mb-4.5 p-6">
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
            defaultValue={vendorProfile.company_name}
            placeholder="e.g. Precision Fab Works Pvt Ltd"
            maxLength={200}
            className={inputClass + (fe?.company_name ? " border-crit" : "")}
          />
          {fe?.company_name && <p className="mt-1 text-[12px] text-crit">{fe.company_name}</p>}
        </div>
        <div className="mb-3.5 grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Business type</label>
            <select
              name="business_type"
              defaultValue={vendorProfile.business_type ?? ""}
              className={inputClass}
            >
              <option value="">Select business type</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>GSTIN</label>
            <input
              name="gstin"
              defaultValue={vendorProfile.gstin ?? ""}
              placeholder="15-character GSTIN"
              maxLength={15}
              autoComplete="off"
              className={inputClass + " uppercase" + (fe?.gstin ? " border-crit" : "")}
            />
            {fe?.gstin && <p className="mt-1 text-[12px] text-crit">{fe.gstin}</p>}
          </div>
        </div>
        <div className="mb-3.5 grid grid-cols-2 gap-3">
          <PanField kyc={kyc} errors={fe} />
          <div>
            <label className={labelClass}>Registered pincode</label>
            <input
              name="registered_pincode"
              defaultValue={vendorProfile.registered_pincode ?? ""}
              placeholder="6-digit pincode"
              inputMode="numeric"
              maxLength={6}
              className={inputClass + (fe?.registered_pincode ? " border-crit" : "")}
            />
            {fe?.registered_pincode && (
              <p className="mt-1 text-[12px] text-crit">{fe.registered_pincode}</p>
            )}
          </div>
        </div>
        <AddressField kyc={kyc} errors={fe} />
      </Card>

      <Card className="mb-4.5 p-6">
        <h3 className="mb-1 text-[14.5px] font-semibold">Manufacturing Capabilities</h3>
        <p className="mb-4.5 text-[12.5px] text-muted">
          Select every process your shop floor can produce &mdash; this decides which orders are
          assigned to you.
        </p>

        <div className="mb-4.5">
          <label className={labelClass}>Processes offered</label>
          <div className="flex flex-wrap gap-2">
            {processOptions.map((p) => {
              const on = capabilities.includes(p.name);
              return (
                <label
                  key={p.id}
                  className={
                    "cursor-pointer rounded-full border-[1.5px] px-3.5 py-2 text-[12.5px] font-semibold " +
                    (on ? "border-brand bg-brand-light text-brand-dark" : "border-grid text-ink-2")
                  }
                >
                  <input
                    type="checkbox"
                    name="capabilities"
                    value={p.name}
                    checked={on}
                    onChange={() => toggle(capabilities, setCapabilities, p.name)}
                    className="hidden"
                  />
                  {p.name}
                </label>
              );
            })}
            {processOptions.length === 0 && (
              <span className="text-[12.5px] text-muted">No processes configured yet.</span>
            )}
          </div>
        </div>

        <div className="mb-4.5">
          <label className={labelClass}>Materials you work with</label>
          <div className="flex flex-wrap gap-2">
            {materialOptions.map((m) => {
              const on = materials.includes(m.name);
              return (
                <label
                  key={m.id}
                  className={
                    "cursor-pointer rounded-full border-[1.5px] px-3.5 py-2 text-[12.5px] font-semibold " +
                    (on ? "border-brand bg-brand-light text-brand-dark" : "border-grid text-ink-2")
                  }
                >
                  <input
                    type="checkbox"
                    name="materials_machined"
                    value={m.name}
                    checked={on}
                    onChange={() => toggle(materials, setMaterials, m.name)}
                    className="hidden"
                  />
                  {m.name}
                </label>
              );
            })}
            {materialOptions.length === 0 && (
              <span className="text-[12.5px] text-muted">No materials configured yet.</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Typical lead time</label>
            <input
              name="typical_lead_time"
              defaultValue={vendorProfile.typical_lead_time ?? ""}
              placeholder="e.g. 3-5 days"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Min. order policy</label>
            <input
              name="min_order_policy"
              defaultValue={vendorProfile.min_order_policy ?? ""}
              placeholder="e.g. No minimum"
              className={inputClass}
            />
          </div>
        </div>
      </Card>

      <Card className="mb-4.5 p-6">
        <h3 className="mb-1 text-[14.5px] font-semibold">Bank &amp; Payout Details</h3>
        <p className="mb-4.5 text-[12.5px] text-muted">
          Used to process your payouts once orders are delivered.
        </p>
        <BankFields kyc={kyc} vendorId={vendorProfile.id} errors={fe} />
      </Card>

      <ConsentBlock kyc={kyc} errors={fe} />

      <div className="flex justify-end gap-2.5">
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending
            ? "Saving…"
            : vendorProfile.kyc_status === "draft" || vendorProfile.kyc_status === "rejected"
              ? "Submit for Approval →"
              : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
