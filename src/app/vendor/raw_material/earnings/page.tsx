import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, StatCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatINR, payoutStatusTone } from "../_lib/helpers";

export default async function EarningsPage() {
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

  const { data: payouts } = await supabase
    .from("payouts")
    .select("*")
    .eq("vendor_id", vendor.id)
    .order("created_at", { ascending: false });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const totalEarned = (payouts ?? [])
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const pendingPayout = (payouts ?? [])
    .filter((p) => p.status === "pending" || p.status === "processing")
    .reduce((sum, p) => sum + p.amount, 0);
  const earningsThisMonth = (payouts ?? [])
    .filter((p) => {
      const created = new Date(p.created_at);
      return created >= monthStart && created < monthEnd;
    })
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div>
      <Topbar title="Earnings" />

      <div className="mt-6 mb-6 grid grid-cols-3 gap-4">
        <StatCard label="Total Earned" value={formatINR(totalEarned)} />
        <StatCard label="Pending Payout" value={formatINR(pendingPayout)} deltaTone="warn" />
        <StatCard label="This Month" value={formatINR(earningsThisMonth)} />
      </div>

      <Card>
        {(payouts ?? []).length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-muted">No payouts yet.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Amount
                </th>
                <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Commission Deducted
                </th>
                <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Status
                </th>
                <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Payout Date
                </th>
              </tr>
            </thead>
            <tbody>
              {(payouts ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="border-b border-grid px-5 py-3 text-[13px] font-semibold">
                    {formatINR(p.amount)}
                  </td>
                  <td className="border-b border-grid px-5 py-3 text-[13px] text-ink-2">
                    {formatINR(p.commission_deducted)}
                  </td>
                  <td className="border-b border-grid px-5 py-3 text-[13px]">
                    <Badge tone={payoutStatusTone(p.status)}>{p.status}</Badge>
                  </td>
                  <td className="border-b border-grid px-5 py-3 text-[13px] text-ink-2">
                    {formatDate(p.payout_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
