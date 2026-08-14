import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  formatDate,
  formatINR,
  orderStatusLabel,
  orderStatusTone,
  rfqStatusTone,
} from "./badge-utils";

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function FabricationOverviewPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: vendorProfile } = await supabase
    .from("vendor_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!vendorProfile) redirect("/login");

  const { start, end } = currentMonthRange();

  const [
    { data: openRfqs },
    { data: myQuoteRfqIds },
    { data: wonQuotes },
    { data: activeOrders },
    { data: payouts },
    { data: recentOrders },
  ] = await Promise.all([
    supabase
      .from("rfqs")
      .select(
        "*, process:master_items!rfqs_process_id_fkey(name), material:master_items!rfqs_material_id_fkey(name)"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("quotes").select("rfq_id").eq("vendor_id", vendorProfile.id),
    supabase
      .from("quotes")
      .select("id, created_at")
      .eq("vendor_id", vendorProfile.id)
      .eq("status", "won"),
    supabase
      .from("orders")
      .select("*")
      .eq("vendor_id", vendorProfile.id)
      .not("status", "in", "(delivered,cancelled,refunded)"),
    supabase.from("payouts").select("amount, payout_date").eq("vendor_id", vendorProfile.id),
    supabase
      .from("orders")
      .select("*")
      .eq("vendor_id", vendorProfile.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const quotedRfqIds = new Set((myQuoteRfqIds ?? []).map((q) => q.rfq_id));
  const capabilities = vendorProfile.capabilities ?? [];

  const matchingOpenRfqs = (openRfqs ?? []).filter((r) => {
    if (quotedRfqIds.has(r.id)) return false;
    if (capabilities.length === 0) return true;
    const processName = (r as unknown as { process: { name: string } | null }).process?.name;
    return processName ? capabilities.includes(processName) : false;
  });

  const wonThisMonth = (wonQuotes ?? []).filter(
    (q) => q.created_at >= start && q.created_at < end
  ).length;

  const payoutsThisMonth = (payouts ?? []).filter(
    (p) => p.payout_date && p.payout_date >= start && p.payout_date < end
  );
  const earningsThisMonth = payoutsThisMonth.reduce((sum, p) => sum + Number(p.amount), 0);

  const recentInbox = matchingOpenRfqs.slice(0, 5);

  return (
    <div>
      <Topbar
        title="Overview"
        pill={{ label: vendorProfile.kyc_status.toUpperCase(), tone: "brand" }}
      />

      <div className="mt-6 grid grid-cols-4 gap-4">
        <StatCard
          label="Open RFQs For You"
          value={String(matchingOpenRfqs.length)}
          delta={capabilities.length === 0 ? "Complete KYC to match by capability" : undefined}
          deltaTone="neutral"
        />
        <StatCard label="Quotes Won (This Month)" value={String(wonThisMonth)} />
        <StatCard label="Active Jobs" value={String((activeOrders ?? []).length)} />
        <StatCard
          label="Earnings (This Month)"
          value={formatINR(earningsThisMonth)}
          delta={
            payoutsThisMonth.length === 0 ? "No payouts recorded yet this month" : undefined
          }
          deltaTone="neutral"
        />
      </div>

      <div className="mt-5 grid grid-cols-[1.5fr_1fr] gap-4.5">
        <Card>
          <CardHeader title="RFQ Inbox" action={{ label: "View all", href: "/vendor/fabrication/rfqs" }} />
          {recentInbox.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-muted">
              No open RFQs match your capabilities right now.
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Process / Material
                  </th>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Qty
                  </th>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Status
                  </th>
                  <th className="border-b border-grid px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {recentInbox.map((rfq) => {
                  const r = rfq as unknown as {
                    id: string;
                    quantity: number;
                    status: "pending" | "quoted" | "accepted" | "expired" | "cancelled";
                    process: { name: string } | null;
                    material: { name: string } | null;
                  };
                  return (
                    <tr key={r.id}>
                      <td className="border-b border-grid px-5 py-3 text-[13px] text-ink-2 last:border-b-0">
                        <span className="font-semibold text-ink">
                          {r.process?.name ?? "Process TBD"}
                        </span>{" "}
                        &middot; {r.material?.name ?? "Material TBD"}
                      </td>
                      <td className="border-b border-grid px-5 py-3 text-[13px] text-ink-2">
                        {r.quantity}
                      </td>
                      <td className="border-b border-grid px-5 py-3">
                        <Badge tone={rfqStatusTone(r.status)}>New</Badge>
                      </td>
                      <td className="border-b border-grid px-5 py-3 text-right">
                        <Link
                          href={`/vendor/fabrication/rfqs/${r.id}`}
                          className="rounded-md bg-brand-light px-2.5 py-1.5 text-[12px] font-bold text-brand"
                        >
                          Quote
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <CardHeader title="Earnings & Payouts" />
          <div className="p-5">
            <div className="mb-1 text-[26px] font-extrabold tracking-tight">
              {formatINR(earningsThisMonth)}
            </div>
            <div className="mb-4.5 text-[12.5px] text-muted">Paid out this month</div>
            <Link
              href="/vendor/fabrication/earnings"
              className="mb-1.5 block rounded-lg bg-brand px-4 py-2.5 text-center text-[13.5px] font-bold text-white"
            >
              View Earnings
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-4.5">
        <Card>
          <CardHeader title="Jobs In Progress" action={{ label: "View all", href: "/vendor/fabrication/orders" }} />
          {(recentOrders ?? []).length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-muted">
              You have no jobs yet.
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Order #
                  </th>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Stage
                  </th>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Total
                  </th>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {(recentOrders ?? []).map((o) => (
                  <tr key={o.id}>
                    <td className="border-b border-grid px-5 py-3 text-[13px] font-semibold text-ink last:border-b-0">
                      <Link href={`/vendor/fabrication/orders/${o.id}`} className="hover:underline">
                        {o.order_number}
                      </Link>
                    </td>
                    <td className="border-b border-grid px-5 py-3">
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
      </div>
    </div>
  );
}
