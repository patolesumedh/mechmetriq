import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  formatDate,
  formatINR,
  nextOrderStatus,
  orderStatusLabel,
  orderStatusTone,
} from "../../badge-utils";
import { StatusUpdateForm } from "./StatusUpdateForm";

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

  const { data: vendorProfile } = await supabase
    .from("vendor_profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!vendorProfile) redirect("/login");

  const { data: order } = await supabase
    .from("orders")
    .select("*, buyer:profiles!orders_buyer_id_fkey(full_name)")
    .eq("id", id)
    .single();

  if (!order || order.vendor_id !== vendorProfile.id) notFound();

  const buyerName = (order as unknown as { buyer: { full_name: string } | null }).buyer?.full_name;

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", id);

  const next = nextOrderStatus(order.status);

  return (
    <div>
      <Topbar
        title={order.order_number}
        pill={{ label: orderStatusLabel(order.status), tone: "brand" }}
      />

      <div className="mt-6 grid grid-cols-[1.5fr_1fr] gap-4.5">
        <div className="space-y-4.5">
          <Card>
            <CardHeader title="Order Items" />
            {orderItems && orderItems.length > 0 ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Description
                    </th>
                    <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Qty
                    </th>
                    <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Unit Price
                    </th>
                    <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Line Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((item) => (
                    <tr key={item.id}>
                      <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink last:border-b-0">
                        {item.description}
                      </td>
                      <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                        {item.quantity}
                      </td>
                      <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                        {formatINR(item.unit_price)}
                      </td>
                      <td className="border-b border-grid px-5 py-3.5 text-[13px] font-semibold text-ink">
                        {formatINR(item.line_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-5 py-8 text-center text-[13px] text-muted">No line items.</div>
            )}
            <div className="space-y-1.5 border-t border-grid px-5 py-4">
              <div className="flex justify-between text-[13px] text-ink-2">
                <span>Subtotal</span>
                <span>{formatINR(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[13px] text-ink-2">
                <span>GST</span>
                <span>{formatINR(order.gst_amount)}</span>
              </div>
              <div className="flex justify-between text-[13px] text-ink-2">
                <span>Shipping</span>
                <span>{formatINR(order.shipping_amount)}</span>
              </div>
              <div className="flex justify-between border-t border-grid pt-1.5 text-[14px] font-bold text-ink">
                <span>Total</span>
                <span>{formatINR(order.total_amount)}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4.5">
          <Card>
            <CardHeader title="Order Summary" />
            <div className="divide-y divide-grid">
              <SpecRow label="Buyer" value={buyerName ?? "—"} />
              <SpecRow label="Order type" value={order.order_type === "custom_part" ? "Custom Part" : "Raw Material"} />
              <SpecRow label="Status" value={<Badge tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge>} />
              <SpecRow label="Tracking number" value={order.tracking_number ?? "—"} />
              <SpecRow label="Created" value={formatDate(order.created_at)} />
              <SpecRow label="Updated" value={formatDate(order.updated_at)} />
            </div>
            {order.invoice_url && (
              <div className="border-t border-grid px-5 py-3.5">
                <a href={order.invoice_url} target="_blank" rel="noreferrer" className="text-[12.5px] font-semibold text-brand">
                  View invoice →
                </a>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Update Status" />
            {next ? (
              <StatusUpdateForm orderId={order.id} nextStatus={next} />
            ) : (
              <div className="px-5 py-6 text-center text-[13px] text-muted">
                No further vendor action available for this order&rsquo;s current stage.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 text-[13px]">
      <span className="text-ink-2">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
