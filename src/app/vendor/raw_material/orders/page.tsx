import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatINR, orderStatusLabel, orderStatusTone } from "../_lib/helpers";

export default async function OrdersPage() {
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

  const { data: orders } = await supabase
    .from("orders")
    .select("id,order_number,status,total_amount,created_at,buyer_id")
    .eq("vendor_id", vendor.id)
    .eq("order_type", "raw_material")
    .order("created_at", { ascending: false });

  const buyerIds = Array.from(new Set((orders ?? []).map((o) => o.buyer_id)));
  const { data: buyers } =
    buyerIds.length > 0
      ? await supabase.from("profiles").select("id,full_name").in("id", buyerIds)
      : { data: [] as { id: string; full_name: string }[] };
  const buyerNameById = new Map((buyers ?? []).map((b) => [b.id, b.full_name]));

  return (
    <div>
      <Topbar title="Orders" />
      <div className="mt-6">
        <Card>
          {(orders ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-muted">No orders yet.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Order #
                  </th>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Buyer
                  </th>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Total
                  </th>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Status
                  </th>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {(orders ?? []).map((o) => (
                  <tr key={o.id}>
                    <td className="border-b border-grid px-5 py-3 text-[13px] font-semibold">
                      <Link href={`/vendor/raw_material/orders/${o.id}`} className="text-brand">
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="border-b border-grid px-5 py-3 text-[13px] text-ink-2">
                      {buyerNameById.get(o.buyer_id) ?? "—"}
                    </td>
                    <td className="border-b border-grid px-5 py-3 text-[13px] text-ink-2">
                      {formatINR(o.total_amount)}
                    </td>
                    <td className="border-b border-grid px-5 py-3 text-[13px]">
                      <Badge tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</Badge>
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
      </div>
    </div>
  );
}
