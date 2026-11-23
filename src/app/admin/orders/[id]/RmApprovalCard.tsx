import { Card, CardHeader } from "@/components/ui/Card";
import { approveRmOrderAction, rejectRmOrderAction } from "../../raw-materials/actions";

const inputClass =
  "w-full rounded-lg border border-grid px-3 py-2 text-[13px] outline-none focus:border-brand";

export function RmApprovalCard({
  orderId,
  eligible,
  allVendors,
  error,
  done,
}: {
  orderId: string;
  eligible: { vendor_id: string; company_name: string; warehouse_pincodes: string | null; lines_covered: number; lines_total: number }[];
  allVendors: { id: string; company_name: string }[];
  error?: string;
  done?: string;
}) {
  const full = eligible.filter((e) => e.lines_covered === e.lines_total);
  const defaultVendor = full[0]?.vendor_id ?? eligible[0]?.vendor_id ?? "";
  const eligibleIds = new Set(eligible.map((e) => e.vendor_id));
  const others = allVendors.filter((v) => !eligibleIds.has(v.id));

  return (
    <Card className="border-[#f5dfa6]">
      <CardHeader title="Approve raw-material order" />
      <div className="space-y-4 p-5 text-[13px]">
        {error && <p className="rounded-lg bg-crit-bg px-3 py-2 text-[#a12525]">{error}</p>}
        {done && <p className="rounded-lg bg-good-bg px-3 py-2 text-[#0a6b0a]">Order {done}.</p>}
        <form action={approveRmOrderAction} className="space-y-3">
          <input type="hidden" name="order_id" value={orderId} />
          <div>
            <label htmlFor="vendor_id" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
              Assign supplier
            </label>
            <select id="vendor_id" name="vendor_id" required defaultValue={defaultVendor} className={inputClass}>
              <option value="" disabled>
                Choose a KYC-approved supplier
              </option>
              {eligible.length > 0 && (
                <optgroup label="Declared supply for these lines">
                  {eligible.map((e) => (
                    <option key={e.vendor_id} value={e.vendor_id}>
                      {e.company_name} — {e.lines_covered}/{e.lines_total} lines
                      {e.warehouse_pincodes ? ` · ${e.warehouse_pincodes}` : ""}
                    </option>
                  ))}
                </optgroup>
              )}
              {others.length > 0 && (
                <optgroup label="Other approved raw-material vendors">
                  {others.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.company_name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {eligible.length === 0 && (
              <p className="mt-1 text-[12px] text-[#8a5a00]">
                No vendor has declared supply for these lines — confirm stock with the supplier before approving.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="freight" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
              Freight — ₹ excl. GST
            </label>
            <input id="freight" name="freight" type="number" step="0.01" min="0" required className={inputClass} />
          </div>
          <div>
            <label htmlFor="note" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
              Note to buyer <span className="font-normal text-muted">(optional)</span>
            </label>
            <input id="note" name="note" maxLength={300} placeholder="e.g. Dispatch in 2 working days from Pune" className={inputClass} />
          </div>
          <button type="submit" className="w-full rounded-lg bg-brand py-2.5 text-[13.5px] font-bold text-white">
            Approve &amp; send for payment
          </button>
        </form>
        <form action={rejectRmOrderAction} className="space-y-2 border-t border-grid pt-4">
          <input type="hidden" name="order_id" value={orderId} />
          <label htmlFor="reject-note" className="block text-[12.5px] font-semibold text-ink-2">
            Or reject with a reason
          </label>
          <input id="reject-note" name="note" required maxLength={300} placeholder="Shown to the buyer" className={inputClass} />
          <button type="submit" className="w-full rounded-lg border border-[#f3c4c4] py-2 text-[13px] font-semibold text-[#a12525] hover:bg-crit-bg">
            Reject order
          </button>
        </form>
      </div>
    </Card>
  );
}
