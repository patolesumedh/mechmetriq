import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatINR, orderStatusLabel, orderStatusTone } from "./_lib/helpers";

export default async function VendorOverviewPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vendor } = await supabase
    .from("vendor_profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!vendor) redirect("/login");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  const [
    { count: activeListingsCount },
    { data: listings },
    { data: recentOrders },
    { count: ordersThisMonthCount },
    { data: payoutsThisMonth },
  ] = await Promise.all([
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendor.id)
      .eq("status", "active"),
    supabase
      .from("listings")
      .select("id,title,available_stock,low_stock_threshold,unit")
      .eq("vendor_id", vendor.id),
    supabase
      .from("orders")
      .select("id,order_number,status,total_amount,created_at,buyer_id")
      .eq("vendor_id", vendor.id)
      .eq("order_type", "raw_material")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendor.id)
      .eq("order_type", "raw_material")
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd),
    supabase
      .from("payouts")
      .select("amount,created_at")
      .eq("vendor_id", vendor.id)
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd),
  ]);

  const lowStockListings = (listings ?? []).filter(
    (l) => l.low_stock_threshold !== null && l.available_stock <= l.low_stock_threshold
  );

  let earningsThisMonth = (payoutsThisMonth ?? []).reduce((sum, p) => sum + p.amount, 0);
  if (!payoutsThisMonth || payoutsThisMonth.length === 0) {
    const { data: ordersThisMonth } = await supabase
      .from("orders")
      .select("total_amount")
      .eq("vendor_id", vendor.id)
      .eq("order_type", "raw_material")
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd);
    earningsThisMonth = (ordersThisMonth ?? []).reduce((sum, o) => sum + o.total_amount, 0);
  }

  return (
    <div>
      <Topbar
        title="Overview"
        pill={{
          label: `KYC: ${vendor.kyc_status.replace("_", " ")}`,
          tone: vendor.kyc_status === "approved" ? "brand" : "orange",
        }}
      />

      <div className="mt-6 mb-6 grid grid-cols-4 gap-4">
        <StatCard label="Active Listings" value={String(activeListingsCount ?? 0)} />
        <StatCard
          label="Low Stock Alerts"
          value={String(lowStockListings.length)}
          delta={lowStockListings.length > 0 ? "Needs attention" : undefined}
          deltaTone="warn"
        />
        <StatCard label="Orders This Month" value={String(ordersThisMonthCount ?? 0)} />
        <StatCard label="Earnings This Month" value={formatINR(earningsThisMonth)} />
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] gap-4.5">
        <Card>
          <CardHeader title="Recent Orders" action={{ label: "View all", href: "/vendor/raw_material/orders" }} />
          {(recentOrders ?? []).length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-muted">No orders yet.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Order #
                  </th>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Status
                  </th>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Total
                  </th>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {(recentOrders ?? []).map((o) => (
                  <tr key={o.id}>
                    <td className="border-b border-grid px-5 py-3 text-[13px] font-semibold">
                      <Link href={`/vendor/raw_material/orders/${o.id}`} className="text-brand">
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="border-b border-grid px-5 py-3 text-[13px]">
                      <Badge tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</Badge>
                    </td>
                    <td className="border-b border-grid px-5 py-3 text-[13px] text-ink-2">
                      {formatINR(o.total_amount)}
                    </td>
                    <td className="border-b border-grid px-5 py-3 text-[13px] text-ink-2">
                      {formatDate(o.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader title="Low Stock Alerts" />
          {lowStockListings.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-muted">All listings are well stocked.</p>
          ) : (
            <div>
              {lowStockListings.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between border-b border-grid px-5 py-3 text-[13px] last:border-b-0"
                >
                  <Link href={`/vendor/raw_material/listings/${l.id}`} className="font-semibold">
                    {l.title}
                  </Link>
                  <span className="font-bold text-[#a12525]">
                    {l.available_stock} {l.unit} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
