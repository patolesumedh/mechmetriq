"use client";

import { useActionState, useState } from "react";
import { updateProfileAction, type ProfileState } from "./actions";
import type { Tables } from "@/lib/types/database";

const initialState: ProfileState = {};
const inputClass =
  "w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand";

export function ProfileForm({
  profile,
  defaultAddress,
}: {
  profile: Tables<"profiles">;
  defaultAddress: { full_address: string; pincode: string } | null;
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);
  const [gstRegistered, setGstRegistered] = useState(profile.gst_registered ?? false);
  const [sameAsBilling, setSameAsBilling] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <div className="rounded-lg bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-[#a12525]">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="rounded-lg bg-good-bg px-3.5 py-3 text-[13px] font-medium text-[#0a6b0a]">
          Profile updated.
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
          Full name *
        </label>
        <input name="full_name" defaultValue={profile.full_name} required className={inputClass} />
      </div>
      <div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Contact number *</label>
        <input
          name="phone"
          type="tel"
          defaultValue={profile.phone ?? ""}
          required
          className={inputClass}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Email *</label>
        <input value={profile.email} disabled className={inputClass + " bg-plane text-muted"} />
      </div>

      <div className="border-t border-grid pt-4">
        <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
          Billing address *
        </label>
        <textarea
          name="billing_address"
          defaultValue={profile.billing_address ?? ""}
          required
          rows={3}
          placeholder="Registered / billing address for invoices"
          className={inputClass}
        />
        <p className="mt-1 text-[11.5px] text-muted">
          This is your account&rsquo;s billing address, used for invoices.
        </p>
      </div>
      <div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
          Billing pincode *
        </label>
        <input
          name="billing_pincode"
          defaultValue={profile.billing_pincode ?? ""}
          required
          inputMode="numeric"
          className={inputClass}
        />
      </div>

      <label className="flex items-center gap-2 border-t border-grid pt-4 text-[13px] font-semibold text-ink">
        <input
          type="checkbox"
          name="shipping_same_as_billing"
          checked={sameAsBilling}
          onChange={(e) => setSameAsBilling(e.target.checked)}
        />
        Same as billing address
      </label>

      {!sameAsBilling && (
        <>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
              Shipping address *
            </label>
            <textarea
              name="shipping_address"
              defaultValue={defaultAddress?.full_address ?? ""}
              required={!sameAsBilling}
              rows={3}
              placeholder="Where orders should be delivered"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
              Shipping pincode *
            </label>
            <input
              name="shipping_pincode"
              defaultValue={defaultAddress?.pincode ?? ""}
              required={!sameAsBilling}
              inputMode="numeric"
              className={inputClass}
            />
          </div>
        </>
      )}

      <label className="flex items-center gap-2 border-t border-grid pt-4 text-[13px] font-semibold text-ink">
        <input
          type="checkbox"
          name="gst_registered"
          checked={gstRegistered}
          onChange={(e) => setGstRegistered(e.target.checked)}
        />
        GST registered
      </label>

      {gstRegistered && (
        <>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
              Organization name *
            </label>
            <input
              name="organization_name"
              defaultValue={profile.organization_name ?? ""}
              required={gstRegistered}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">GSTIN *</label>
            <input
              name="gstin"
              defaultValue={profile.gstin ?? ""}
              required={gstRegistered}
              placeholder="22AAAAA0000A1Z5"
              className={inputClass + " uppercase"}
            />
          </div>
        </>
      )}
      {!gstRegistered && (
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
            Organization name <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            name="organization_name"
            defaultValue={profile.organization_name ?? ""}
            className={inputClass}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-[9px] bg-brand px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
