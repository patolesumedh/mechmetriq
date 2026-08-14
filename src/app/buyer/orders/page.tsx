import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { formatCurrency, formatDate, orderStatusTone, statusLabel } from "../_lib/ui";

export default async function OrdersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });
  const allOrders = orders ?? [];

  const vendorIds = Array.from(new Set(allOrders.map((o) => o.vendor_id)));
  const { data: vendors } = await supabase
    .from("vendor_profiles")
    .select("id, company_name")
    .in("id", vendorIds);
  const vendorMap = new Map((vendors ?? []).map((v) => [v.id, v.company_name]));

  return (
    <>
      <div className="-mx-7 -mt-7 mb-7">
        <Topbar title="My Orders" />
      </div>

      {allOrders.length > 0 ? (
        <Card>
          <div className="divide-y divide-grid">
            {allOrders.map((order) => (
              <Link
                key={order.id}
                href={`/buyer/orders/${order.id}`}
                className="flex items-center justify-between px-5 py-4 text-[13.5px] hover:bg-plane"
              >
                <div>
                  <div className="flex items-center gap-2 font-semibold text-ink">
                    {order.order_number}
                    <Badge tone={order.order_type === "custom_part" ? "production" : "active"}>
                      {order.order_type === "custom_part" ? "Custom Part" : "Raw Material"}
                    </Badge>
                  </div>
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
        </Card>
      ) : (
        <Card className="flex flex-col items-center gap-3 px-5 py-14 text-center">
          <p className="text-[13.5px] text-ink-2">You don&rsquo;t have any orders yet.</p>
          <ButtonLink href="/buyer/marketplace">Browse Marketplace</ButtonLink>
        </Card>
      )}
    </>
  );
}
