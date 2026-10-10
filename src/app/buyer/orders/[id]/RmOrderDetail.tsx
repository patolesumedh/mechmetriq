import Link from "next/link";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { RmLinesTable, RmTotals } from "@/components/rawMaterials/RmOrderParts";
import { inr, rmStatusLabel } from "@/lib/rawMaterials/format";
import type { Enums, Tables } from "@/lib/types/database";
import { PAY_METHOD_LABEL, isTestPaymentRef } from "@/lib/payments/testGateway";
import { formatDate } from "../../_lib/ui";
import { RmCancelForm, RmPayForm } from "./RmOrderActions";

const STEPS = [
  { key: "placed", label: "Placed" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
  { key: "shipped", label: "Dispatched" },
  { key: "delivered", label: "Delivered" },
];

function stepIndex(status: string): number {
  switch (status) {
    case "draft":
      return 0;
    case "quoted":
      return 1;
    case "accepted_paid":
    case "in_production":
    case "qc_ready":
      return 2;
    case "shipped":
      return 3;
    case "delivered":
      return 4;
    default:
      return -1;
  }
}

export function RmOrderDetail({
  order,
  items,
  address,
  justPlaced,
  justPaid,
  payment,
  contact,
}: {
  order: Tables<"orders">;
  items: Tables<"order_items">[];
  address: { label: string; full_address: string; pincode: string } | null;
  justPlaced: boolean;
  justPaid: boolean;
  payment: { method: Enums<"payment_method">; gateway_ref: string | null; created_at: string } | null;
  contact: { email: string; phone: string | null };
}) {
  const current = stepIndex(order.status);
  const cancelled = order.status === "cancelled";

  return (
    <>
      <div className="-mx-7 -mt-7 mb-7">
        <Topbar
          title={`Order ${order.order_number}`}
          pill={{ label: rmStatusLabel(order.status), tone: order.status === "quoted" ? "orange" : "brand" }}
          right={
            <Link href={`/buyer/orders/${order.id}/proforma`} className="text-[13px] font-semibold text-brand">
              Proforma invoice &rarr;
            </Link>
          }
        />
      </div>

      {justPlaced && order.status === "draft" && (
        <Card className="mb-5 border-[#bfe3bf] bg-good-bg px-5 py-3.5 text-[13px] text-[#0a6b0a]">
          <b>Order placed.</b> Your proforma is ready. We&rsquo;ll assign a supplier and confirm freight — you&rsquo;ll
          pay once it&rsquo;s approved.
        </Card>
      )}
      {justPaid && order.status === "accepted_paid" && (
        <div className="mb-5 flex items-start gap-3 rounded-[10px] border border-[#bfe6bf] bg-good-bg px-4 py-3.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-good text-[14px] font-bold text-white">
            ✓
          </span>
          <div className="text-[13px] text-[#0a5a0a]">
            <div className="text-[14px] font-bold">Payment received — your order is confirmed</div>
            Your supplier will now prepare and dispatch the material. You&rsquo;ll see tracking here once it ships.
          </div>
        </div>
      )}
      {cancelled && (
        <Card className="mb-5 border-[#f3c4c4] bg-crit-bg px-5 py-3.5 text-[13px] text-[#a12525]">
          <b>This order was cancelled.</b>
          {order.rm_admin_note ? ` Reason: ${order.rm_admin_note}` : ""}
        </Card>
      )}

      {!cancelled && (
        <ol className="mb-6 grid grid-cols-5 gap-2" aria-label="Order progress">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex flex-col gap-1.5">
              <span className={"h-1.5 rounded-full " + (i <= current ? "bg-brand" : "bg-grid")} />
              <span className={"text-[12px] " + (i <= current ? "font-semibold text-ink" : "text-muted")}>
                {s.label}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title={`Items · placed ${formatDate(order.created_at)}`} />
            <RmLinesTable items={items} />
          </Card>
          <Card>
            <CardHeader title="Delivery" />
            <div className="grid gap-4 px-5 py-4 text-[13px] sm:grid-cols-2">
              <div>
                <div className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted">Address</div>
                {address ? (
                  <div className="text-ink-2">
                    <b className="block text-ink">{address.label}</b>
                    {address.full_address} — {address.pincode}
                  </div>
                ) : (
                  "—"
                )}
              </div>
              <div>
                <div className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted">Billing GSTIN</div>
                <div className="text-ink-2">{order.billing_gstin ?? "Not provided"}</div>
                {order.tracking_number && (
                  <>
                    <div className="mb-1 mt-3 text-[11.5px] font-semibold uppercase tracking-wide text-muted">
                      Tracking
                    </div>
                    <div className="font-semibold text-ink">{order.tracking_number}</div>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>

        <Card className="flex flex-col gap-4 p-5">
          <h3 className="text-[14.5px] font-semibold">Summary</h3>
          <RmTotals order={order} />
          {order.rm_admin_note && !cancelled && (
            <p className="rounded-lg bg-plane px-3 py-2 text-[12.5px] text-ink-2">
              <b className="text-ink">Note from MECHmetrIQ: </b>
              {order.rm_admin_note}
            </p>
          )}
          {order.status === "draft" && (
            <>
              <p className="rounded-lg bg-warn-bg px-3 py-2 text-[12.5px] text-[#8a5a00]">
                Awaiting approval. We&rsquo;ll confirm freight and the final total before you pay.
              </p>
              <RmCancelForm orderId={order.id} />
            </>
          )}
          {order.status === "quoted" && (
            <>
              <RmPayForm
                orderId={order.id}
                orderNumber={order.order_number}
                amount={Number(order.total_amount)}
                amountLabel={inr(order.total_amount, true)}
                lineCount={items.length}
                contact={contact}
              />
              <RmCancelForm orderId={order.id} />
            </>
          )}
          {order.rm_paid_at && (
            <div className="rounded-lg border border-grid px-3.5 py-2.5 text-[12.5px]">
              <div className="flex items-center gap-1.5 font-semibold text-good">
                Paid on {formatDate(order.rm_paid_at)}
                {payment && <span className="text-ink-2">· {PAY_METHOD_LABEL[payment.method]}</span>}
                {isTestPaymentRef(payment?.gateway_ref) && (
                  <span className="rounded bg-[#fff1c2] px-1.5 py-[1px] text-[9.5px] font-extrabold tracking-wider text-[#6b4d00]">
                    TEST
                  </span>
                )}
              </div>
              {payment?.gateway_ref && (
                <div className="mt-0.5 font-mono text-[11.5px] text-muted">{payment.gateway_ref}</div>
              )}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
