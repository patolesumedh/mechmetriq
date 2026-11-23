import { Card, CardHeader } from "@/components/ui/Card";
import { assignCustomPartVendorAction } from "../actions";

const inputClass =
  "w-full rounded-lg border border-grid px-3 py-2 text-[13px] outline-none focus:border-brand";

export type EligibleFabVendor = {
  vendor_id: string;
  company_name: string;
  process_match: boolean;
  material_match: boolean;
  typical_lead_time: string | null;
  commission_override: number | null;
  rating: number | null;
};

function suggestedPayout(subtotal: number, commission: number | null | undefined) {
  if (commission == null) return "";
  return (Math.round(subtotal * (1 - commission / 100) * 100) / 100).toFixed(2);
}

export function AssignVendorCard({
  orderId,
  subtotal,
  vendors,
  current,
  processLabel,
  error,
  done,
}: {
  orderId: string;
  subtotal: number;
  vendors: EligibleFabVendor[];
  current: { vendor_id: string; vendor_payout: number; note: string | null } | null;
  processLabel: string | null;
  error?: string;
  done?: string;
}) {
  const matched = vendors.filter((v) => v.process_match && v.material_match);
  const partial = vendors.filter((v) => !(v.process_match && v.material_match));
  const defaultVendor = current?.vendor_id ?? matched[0]?.vendor_id ?? "";
  const defaultCommission = vendors.find((v) => v.vendor_id === defaultVendor)?.commission_override;
  const defaultPayout = current ? current.vendor_payout.toFixed(2) : suggestedPayout(subtotal, defaultCommission);

  const label = (v: EligibleFabVendor) => {
    const tags = [
      !v.process_match ? `no ${processLabel ?? "process"}` : null,
      !v.material_match ? "material not declared" : null,
      v.typical_lead_time ? v.typical_lead_time : null,
      v.commission_override != null ? `${v.commission_override}% commission` : null,
    ].filter(Boolean);
    return tags.length ? `${v.company_name} — ${tags.join(" · ")}` : v.company_name;
  };

  return (
    <Card className={current ? undefined : "border-[#f5dfa6]"}>
      <CardHeader title={current ? "Reassign machining vendor" : "Route to machining vendor"} />
      <div className="space-y-4 p-5 text-[13px]">
        {error && <p className="rounded-lg bg-crit-bg px-3 py-2 text-[#a12525]">{error}</p>}
        {done && <p className="rounded-lg bg-good-bg px-3 py-2 text-[#0a6b0a]">Vendor {done}. It now shows in their Jobs &amp; Orders.</p>}
        {!current && !done && (
          <p className="text-ink-2">
            Paid by the buyer and waiting for a vendor. The order is invisible to vendors until you assign one.
          </p>
        )}
        {vendors.length === 0 ? (
          <p className="rounded-lg bg-warn-bg px-3 py-2 text-[#8a5a00]">
            No KYC-approved fabrication vendors yet. Approve one under Vendors first.
          </p>
        ) : (
          <form action={assignCustomPartVendorAction} className="space-y-3">
            <input type="hidden" name="order_id" value={orderId} />
            <div>
              <label htmlFor="cp_vendor_id" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
                Vendor
              </label>
              <select id="cp_vendor_id" name="vendor_id" required defaultValue={defaultVendor} className={inputClass}>
                <option value="" disabled>
                  Choose a KYC-approved fabrication vendor
                </option>
                {matched.length > 0 && (
                  <optgroup label="Declared this process and material">
                    {matched.map((v) => (
                      <option key={v.vendor_id} value={v.vendor_id}>
                        {label(v)}
                      </option>
                    ))}
                  </optgroup>
                )}
                {partial.length > 0 && (
                  <optgroup label="Other approved fabrication vendors">
                    {partial.map((v) => (
                      <option key={v.vendor_id} value={v.vendor_id}>
                        {label(v)}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {matched.length === 0 && (
                <p className="mt-1 text-[12px] text-[#8a5a00]">
                  No vendor has declared this process and material. Confirm capability before assigning.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="cp_payout" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
                Vendor payout — ₹ excl. GST
              </label>
              <input
                id="cp_payout"
                name="payout"
                type="number"
                step="0.01"
                min="0.01"
                max={subtotal}
                required
                defaultValue={defaultPayout}
                className={inputClass}
              />
              <p className="mt-1 text-[12px] text-muted">
                Buyer subtotal ₹{subtotal.toLocaleString("en-IN")}. The vendor&rsquo;s job page shows this payout, not the buyer price.
              </p>
            </div>
            <div>
              <label htmlFor="cp_note" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
                Note to vendor <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="cp_note"
                name="note"
                maxLength={300}
                defaultValue={current?.note ?? ""}
                placeholder="e.g. Deburr all edges; ship by 20 Oct"
                className={inputClass}
              />
            </div>
            <button type="submit" className="w-full rounded-lg bg-brand py-2.5 text-[13.5px] font-bold text-white">
              {current ? "Save reassignment" : "Assign vendor & release job"}
            </button>
          </form>
        )}
      </div>
    </Card>
  );
}
