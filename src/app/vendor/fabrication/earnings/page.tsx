import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, StatCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatINR, payoutStatusTone } from "../badge-utils";

function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function EarningsPage() {
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

  const { data: payouts } = await supabase
    .from("payouts")
    .select("*")
    .eq("vendor_id", vendorProfile.id)
    .order("created_at", { ascending: false });

  const rows = payouts ?? [];
  const { start, end } = currentMonthRange();

  const totalEarned = rows
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const pendingPayout = rows
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const thisMonth = rows
    .filter((p) => p.payout_date && p.payout_date >= start && p.payout_date < end)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div>
      <Topbar title="Earnings" pill={{ label: `${rows.length} payouts`, tone: "brand" }} />

      <div className="mt-6 grid grid-cols-3 gap-4">
        <StatCard label="Total Earned (Paid)" value={formatINR(totalEarned)} />
        <StatCard label="Pending Payout" value={formatINR(pendingPayout)} deltaTone="warn" />
        <StatCard label="This Month" value={formatINR(thisMonth)} />
      </div>

      <div className="mt-5">
        <Card>
          {rows.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-muted">
              No payouts recorded yet.
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Amount
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Commission Deducted
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Status
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Payout Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="border-b border-grid px-5 py-3.5 text-[13px] font-semibold text-ink last:border-b-0">
                      {formatINR(p.amount)}
                    </td>
                    <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                      {formatINR(p.commission_deducted)}
                    </td>
                    <td className="border-b border-grid px-5 py-3.5">
                      <Badge tone={payoutStatusTone(p.status)}>{p.status}</Badge>
                    </td>
                    <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                      {p.payout_date ? formatDate(p.payout_date) : "—"}
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
