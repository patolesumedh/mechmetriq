import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatINR, orderStatusLabel, orderStatusTone } from "../badge-utils";
import type { Enums } from "@/lib/types/database";

type OrderRow = {
  id: string;
  order_number: string;
  order_type: Enums<"order_type">;
  status: Enums<"order_status">;
  total_amount: number;
  created_at: string;
  buyer: { full_name: string } | null;
};

export default async function JobsOrdersPage() {
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

  const { data: orders } = await supabase
    .from("orders")
    .select("*, buyer:profiles!orders_buyer_id_fkey(full_name)")
    .eq("vendor_id", vendorProfile.id)
    .order("created_at", { ascending: false });

  const rows = (orders ?? []) as unknown as OrderRow[];

  return (
    <div>
      <Topbar title="Jobs & Orders" pill={{ label: `${rows.length} total`, tone: "brand" }} />

      <div className="mt-6">
        <Card>
          {rows.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-muted">
              You have no jobs yet.
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Order #
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Buyer
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Type
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Total
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Status
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Created
                  </th>
                  <th className="border-b border-grid px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td className="border-b border-grid px-5 py-3.5 text-[13px] font-semibold text-ink last:border-b-0">
                      {o.order_number}
                    </td>
                    <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                      {o.buyer?.full_name ?? "—"}
                    </td>
                    <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                      {o.order_type === "custom_part" ? "Custom Part" : "Raw Material"}
                    </td>
                    <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                      {formatINR(o.total_amount)}
                    </td>
                    <td className="border-b border-grid px-5 py-3.5">
                      <Badge tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</Badge>
                    </td>
                    <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                      {formatDate(o.created_at)}
                    </td>
                    <td className="border-b border-grid px-5 py-3.5 text-right">
                      <Link
                        href={`/vendor/fabrication/orders/${o.id}`}
                        className="rounded-md bg-brand-light px-2.5 py-1.5 text-[12px] font-bold text-brand"
                      >
                        View
                      </Link>
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
