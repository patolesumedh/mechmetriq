import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import {
  formatCurrency,
  formatDate,
  orderStatusTone,
  rfqStatusTone,
  statusLabel,
} from "./_lib/ui";

const OPEN_RFQ_STATUSES = new Set(["pending", "quoted"]);
const INACTIVE_ORDER_STATUSES = new Set(["delivered", "cancelled", "refunded"]);

export default async function BuyerOverviewPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rfqs }, { data: orders }] = await Promise.all([
    supabase
      .from("rfqs")
      .select("*")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("*")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const allRfqs = rfqs ?? [];
  const allOrders = orders ?? [];

  const openRfqCount = allRfqs.filter((r) => OPEN_RFQ_STATUSES.has(r.status)).length;
  const activeOrderCount = allOrders.filter((o) => !INACTIVE_ORDER_STATUSES.has(o.status)).length;
  const totalSpend = allOrders.reduce((sum, o) => sum + (o.total_amount ?? 0), 0);

  const recentRfqs = allRfqs.slice(0, 5);
  const recentOrders = allOrders.slice(0, 5);

  const itemIds = Array.from(
    new Set(
      recentRfqs.flatMap((r) => [r.process_id, r.material_id]).filter((v): v is string => Boolean(v))
    )
  );
  const { data: items } = await supabase.from("master_items").select("id, name").in("id", itemIds);
  const itemMap = new Map((items ?? []).map((i) => [i.id, i.name]));

  const vendorIds = Array.from(new Set(recentOrders.map((o) => o.vendor_id)));
  const { data: vendors } = await supabase
    .from("vendor_profiles")
    .select("id, company_name")
    .in("id", vendorIds);
  const vendorMap = new Map((vendors ?? []).map((v) => [v.id, v.company_name]));

  return (
    <>
      <div className="-mx-7 -mt-7 mb-7">
        <Topbar title="Overview" />
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard label="Open RFQs" value={String(openRfqCount)} />
        <StatCard label="Active Orders" value={String(activeOrderCount)} />
        <StatCard label="Total Spend" value={formatCurrency(totalSpend)} />
      </div>

      <div className="mb-6">
        <Card>
          <CardHeader title="Recent RFQs" action={{ label: "View all", href: "/buyer/quotes" }} />
          {recentRfqs.length > 0 ? (
            <div className="divide-y divide-grid">
              {recentRfqs.map((rfq) => (
                <div
                  key={rfq.id}
                  className="flex items-center justify-between px-5 py-3.5 text-[13.5px]"
                >
                  <div>
                    <div className="font-semibold text-ink">
                      {itemMap.get(rfq.process_id ?? "") ?? "Custom part"}
                      {rfq.material_id && ` · ${itemMap.get(rfq.material_id) ?? ""}`}
                    </div>
                    <div className="text-[12px] text-muted">
                      Qty {rfq.quantity} · {formatDate(rfq.created_at)}
                    </div>
                  </div>
                  <Badge tone={rfqStatusTone(rfq.status)}>{statusLabel(rfq.status)}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
              <p className="text-[13.5px] text-ink-2">You haven&rsquo;t submitted any RFQs yet.</p>
              <ButtonLink href="/buyer/quote">Get Instant Quote</ButtonLink>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent Orders" action={{ label: "View all", href: "/buyer/orders" }} />
        {recentOrders.length > 0 ? (
          <div className="divide-y divide-grid">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/buyer/orders/${order.id}`}
                className="flex items-center justify-between px-5 py-3.5 text-[13.5px] hover:bg-plane"
              >
                <div>
                  <div className="font-semibold text-ink">{order.order_number}</div>
                  <div className="text-[12px] text-muted">
                    {vendorMap.get(order.vendor_id) ?? "Vendor"} · {formatDate(order.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{formatCurrency(order.total_amount)}</span>
                  <Badge tone={orderStatusTone(order.status)}>{statusLabel(order.status)}</Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <p className="text-[13.5px] text-ink-2">No orders yet.</p>
            <ButtonLink href="/buyer/marketplace">Browse Marketplace</ButtonLink>
          </div>
        )}
      </Card>
    </>
  );
}
