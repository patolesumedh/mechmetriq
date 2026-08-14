"use client";

import { useActionState } from "react";
import { updateKycAction, type OnboardingState } from "./actions";
import type { Tables } from "@/lib/types/database";

const initialState: OnboardingState = {};

const inputClass =
  "w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand";
const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-2";

export function OnboardingForm({
  vendor,
  materials,
}: {
  vendor: Tables<"vendor_profiles">;
  materials: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateKycAction, initialState);
  const materialsHandled = new Set(vendor.materials_handled ?? []);

  return (
    <form action={formAction} className="max-w-[760px]">
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
            className={inputClass}
          />
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
              className={inputClass}
            />
          </div>
        </div>
        <div className="mb-3.5 grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>
              PAN <span className="text-crit">*</span>
            </label>
            <input
              name="pan"
              required
              defaultValue={vendor.pan ?? ""}
              placeholder="10-character PAN"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              Warehouse / dispatch pincode <span className="text-crit">*</span>
            </label>
            <input
              name="warehouse_pincode"
              required
              defaultValue={vendor.warehouse_pincode ?? ""}
              placeholder="6-digit pincode"
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>
            Registered address <span className="text-crit">*</span>
          </label>
          <input
            name="registered_address"
            required
            defaultValue={vendor.registered_address ?? ""}
            placeholder="Full address"
            className={inputClass}
          />
        </div>
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
        <div className="mt-3.5">
          <label className={labelClass}>Certifications URL (optional)</label>
          <input
            name="certifications_url"
            defaultValue={vendor.certifications_url ?? ""}
            placeholder="Link to mill test certificate, ISO, etc."
            className={inputClass}
          />
        </div>
      </div>

      <div className="mb-4.5 rounded-[10px] border border-grid bg-surface p-6">
        <h3 className="mb-1 text-[14.5px] font-semibold">Bank &amp; Payout Details</h3>
        <p className="mb-4.5 text-[12.5px] text-muted">
          Used to process your marketplace payouts.
        </p>
        <div className="mb-3.5 grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Bank account number</label>
            <input
              name="bank_account_number"
              defaultValue={vendor.bank_account_number ?? ""}
              placeholder="9-18 digits"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>IFSC code</label>
            <input
              name="ifsc_code"
              defaultValue={vendor.ifsc_code ?? ""}
              placeholder="11-character IFSC"
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Cancelled cheque / bank doc URL</label>
          <input
            name="cancelled_cheque_url"
            defaultValue={vendor.cancelled_cheque_url ?? ""}
            placeholder="Link to uploaded document"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-5 py-3 text-[14.5px] font-bold text-white disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : vendor.kyc_status === "draft"
              ? "Submit for Approval →"
              : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
