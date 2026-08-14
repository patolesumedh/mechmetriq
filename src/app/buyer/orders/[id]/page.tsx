import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  formatCurrency,
  formatDate,
  orderStatusTone,
  paymentStatusTone,
  statusLabel,
} from "../../_lib/ui";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();
  if (!order || order.buyer_id !== user.id) notFound();

  const [{ data: items }, { data: payments }, { data: vendor }, { data: address }] =
    await Promise.all([
      supabase.from("order_items").select("*").eq("order_id", order.id),
      supabase
        .from("payments")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false }),
      supabase.from("vendor_profiles").select("company_name").eq("id", order.vendor_id).single(),
      order.delivery_address_id
        ? supabase.from("addresses").select("*").eq("id", order.delivery_address_id).single()
        : Promise.resolve({ data: null }),
    ]);

  return (
    <>
      <div className="-mx-7 -mt-7 mb-7">
        <Topbar title={`Order ${order.order_number}`} />
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div className="text-[13.5px] text-ink-2">
          {vendor?.company_name ?? "Vendor"} · Placed {formatDate(order.created_at)}
        </div>
        <Badge tone={orderStatusTone(order.status)}>{statusLabel(order.status)}</Badge>
      </div>

      <div className="mb-6 grid grid-cols-[1.6fr_1fr] gap-5">
        <Card>
          <CardHeader title="Items" />
          <div className="divide-y divide-grid">
            {(items ?? []).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-5 py-3.5 text-[13.5px]"
              >
                <div>
                  <div className="font-semibold text-ink">{item.description}</div>
                  <div className="text-[12px] text-muted">
                    Qty {item.quantity} × {formatCurrency(item.unit_price)}
                  </div>
                </div>
                <span className="font-semibold">{formatCurrency(item.line_total)}</span>
              </div>
            ))}
            {(!items || items.length === 0) && (
              <div className="px-5 py-6 text-[13px] text-ink-2">No line items recorded.</div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Summary" />
          <div className="flex flex-col gap-2 px-5 py-4 text-[13.5px]">
            <SummaryRow label="Subtotal" value={formatCurrency(order.subtotal)} />
            <SummaryRow label="GST" value={formatCurrency(order.gst_amount)} />
            <SummaryRow label="Shipping" value={formatCurrency(order.shipping_amount)} />
            <div className="my-1.5 border-t border-grid" />
            <SummaryRow label="Total" value={formatCurrency(order.total_amount)} strong />
            {order.tracking_number && (
              <SummaryRow label="Tracking #" value={order.tracking_number} />
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Card>
          <CardHeader title="Delivery Address" />
          <div className="px-5 py-4 text-[13.5px] text-ink-2">
            {address ? (
              <>
                <div className="font-semibold text-ink">{address.label}</div>
                <div>{address.full_address}</div>
                <div>{address.pincode}</div>
              </>
            ) : (
              "No delivery address on file."
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Payments" />
          <div className="divide-y divide-grid">
            {(payments ?? []).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-5 py-3.5 text-[13.5px]"
              >
                <div>
                  <div className="font-semibold capitalize text-ink">{p.method}</div>
                  <div className="text-[12px] text-muted">{formatDate(p.created_at)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatCurrency(p.amount)}</span>
                  <Badge tone={paymentStatusTone(p.status)}>{statusLabel(p.status)}</Badge>
                </div>
              </div>
            ))}
            {(!payments || payments.length === 0) && (
              <div className="px-5 py-6 text-[13px] text-ink-2">No payments recorded.</div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={
        "flex items-center justify-between " +
        (strong ? "text-[14.5px] font-bold text-ink" : "text-ink-2")
      }
    >
      <span>{label}</span>
      <span className={strong ? "" : "font-medium text-ink"}>{value}</span>
    </div>
  );
}
