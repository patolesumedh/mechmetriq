import type { Tables } from "@/lib/types/database";
import { inr, kg, num } from "@/lib/rawMaterials/format";

type Item = Tables<"order_items">;
type Order = Tables<"orders">;

/** Line table for a raw-material order (proforma-style). */
export function RmLinesTable({ items, showHsn = true }: { items: Item[]; showHsn?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-grid text-left text-[10.5px] uppercase tracking-wide text-muted">
            <th className="px-4 py-2 font-semibold">#</th>
            <th className="px-4 py-2 font-semibold">Description</th>
            {showHsn && <th className="px-4 py-2 font-semibold">HSN</th>}
            <th className="px-4 py-2 text-right font-semibold">Qty</th>
            <th className="px-4 py-2 text-right font-semibold">Weight</th>
            <th className="px-4 py-2 text-right font-semibold">Rate/kg</th>
            <th className="px-4 py-2 text-right font-semibold">Material</th>
            <th className="px-4 py-2 text-right font-semibold">Cut / MTC</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id} className="border-b border-grid align-top last:border-0">
              <td className="px-4 py-2.5 text-muted">{i + 1}</td>
              <td className="min-w-[200px] px-4 py-2.5 font-medium text-ink">{it.description}</td>
              {showHsn && <td className="px-4 py-2.5 text-ink-2">{it.rm_hsn_code ?? "—"}</td>}
              <td className="whitespace-nowrap px-4 py-2.5 text-right">
                {it.rm_sell_by === "kg" ? kg(Number(it.quantity)) : `${num(Number(it.quantity), 0)} pcs`}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right">{kg(Number(it.rm_weight_kg))}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right">{inr(Number(it.rm_rate_per_kg), true)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold">
                {inr(Number(it.rm_material_value), true)}
              </td>
              <td className="px-4 py-2.5 text-right text-ink-2">
                {it.rm_cut ? `Cut ${inr(Number(it.rm_cut_charge), true)}` : ""}
                {it.rm_cut && it.rm_mtc ? <br /> : ""}
                {it.rm_mtc ? `MTC ${inr(Number(it.rm_mtc_fee), true)}` : ""}
                {!it.rm_cut && !it.rm_mtc ? "—" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Money breakdown for a raw-material order. */
export function RmTotals({ order }: { order: Order }) {
  const approved = order.status !== "draft" && order.status !== "cancelled";
  const rows: [string, string, string?][] = [
    ["Total weight", kg(Number(order.rm_total_weight_kg))],
    ["Material", inr(Number(order.rm_material_value), true)],
  ];
  if (Number(order.rm_bulk_discount) > 0) rows.push(["Bulk discount", `−${inr(Number(order.rm_bulk_discount), true)}`, "good"]);
  if (Number(order.rm_cut_charges) > 0) rows.push(["Cutting", inr(Number(order.rm_cut_charges), true)]);
  if (Number(order.rm_mtc_charges) > 0) rows.push(["MTC", inr(Number(order.rm_mtc_charges), true)]);
  rows.push(["Taxable value", inr(order.subtotal, true)]);
  rows.push(["Freight", approved || order.shipping_amount > 0 ? inr(order.shipping_amount, true) : "confirmed on approval"]);
  rows.push(["GST", inr(order.gst_amount, true)]);
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-[13px]">
      {rows.map(([k, v, tone]) => (
        <div key={k} className="contents">
          <dt className={tone === "good" ? "text-good" : "text-ink-2"}>{k}</dt>
          <dd className={"text-right font-medium " + (tone === "good" ? "text-good" : "")}>{v}</dd>
        </div>
      ))}
      <dt className="mt-1 border-t border-grid pt-2 text-[14.5px] font-bold">
        {approved ? "Total payable" : "Total (excl. freight)"}
      </dt>
      <dd className="mt-1 border-t border-grid pt-2 text-right text-[15px] font-extrabold">
        {inr(order.total_amount, true)}
      </dd>
    </dl>
  );
}
