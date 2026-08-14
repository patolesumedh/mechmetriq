import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatINR, orderStatusLabel, orderStatusTone } from "../../_lib/helpers";
import { OrderStatusForm } from "./OrderStatusForm";

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

  const { data: vendor } = await supabase
    .from("vendor_profiles")
    .select("id")
    .eq("id", user.id)
    .single();
  if (!vendor) redirect("/login");

  const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();
  if (!order || order.vendor_id !== vendor.id) {
    redirect("/vendor/raw_material/orders");
  }

  const [{ data: orderItems }, { data: buyer }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", order.id),
    supabase.from("profiles").select("full_name,email,phone").eq("id", order.buyer_id).single(),
  ]);

  const listingIds = Array.from(
    new Set((orderItems ?? []).map((it) => it.listing_id).filter((v): v is string => !!v))
  );
  const { data: listings } =
    listingIds.length > 0
      ? await supabase.from("listings").select("id,title").in("id", listingIds)
      : { data: [] as { id: string; title: string }[] };
  const listingTitleById = new Map((listings ?? []).map((l) => [l.id, l.title]));

  return (
    <div>
      <Topbar
        title={`Order ${order.order_number}`}
        right={<Badge tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge>}
      />

      <div className="mt-6 grid grid-cols-[1.5fr_1fr] gap-4.5">
        <Card>
          <CardHeader title="Order Items" />
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Item
                </th>
                <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Qty
                </th>
                <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Unit Price
                </th>
                <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Line Total
                </th>
              </tr>
            </thead>
            <tbody>
              {(orderItems ?? []).map((it) => (
                <tr key={it.id}>
                  <td className="border-b border-grid px-5 py-3 text-[13px] font-semibold">
                    {it.listing_id ? (listingTitleById.get(it.listing_id) ?? it.description) : it.description}
                  </td>
                  <td className="border-b border-grid px-5 py-3 text-[13px] text-ink-2">{it.quantity}</td>
                  <td className="border-b border-grid px-5 py-3 text-[13px] text-ink-2">
                    {formatINR(it.unit_price)}
                  </td>
                  <td className="border-b border-grid px-5 py-3 text-[13px] text-ink-2">
                    {formatINR(it.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-grid px-5 py-4 text-[13px]">
            <div className="flex justify-between py-1 text-ink-2">
              <span>Subtotal</span>
              <span>{formatINR(order.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1 text-ink-2">
              <span>GST</span>
              <span>{formatINR(order.gst_amount)}</span>
            </div>
            <div className="flex justify-between py-1 text-ink-2">
              <span>Shipping</span>
              <span>{formatINR(order.shipping_amount)}</span>
            </div>
            <div className="flex justify-between border-t border-grid py-2 font-bold text-ink">
              <span>Total</span>
              <span>{formatINR(order.total_amount)}</span>
            </div>
          </div>

          <OrderStatusForm orderId={order.id} status={order.status} />
        </Card>

        <div>
          <Card className="mb-4.5 p-5">
            <h3 className="mb-3 text-[14.5px] font-semibold">Buyer</h3>
            <div className="text-[13px] text-ink-2">
              <div className="mb-1 font-semibold text-ink">{buyer?.full_name ?? "—"}</div>
              {buyer?.email && <div>{buyer.email}</div>}
              {buyer?.phone && <div>{buyer.phone}</div>}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 text-[14.5px] font-semibold">Shipping</h3>
            <div className="text-[13px] text-ink-2">
              <div className="mb-2 flex justify-between">
                <span>Order date</span>
                <span className="font-semibold text-ink">{formatDate(order.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tracking number</span>
                <span className="font-semibold text-ink">{order.tracking_number ?? "—"}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
