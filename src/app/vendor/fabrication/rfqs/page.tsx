import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "../badge-utils";

type RfqRow = {
  id: string;
  quantity: number;
  tolerance: string | null;
  lead_time_pref: string | null;
  created_at: string;
  process: { name: string } | null;
  material: { name: string } | null;
};

export default async function RfqInboxPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: vendorProfile } = await supabase
    .from("vendor_profiles")
    .select("id, capabilities")
    .eq("id", user.id)
    .single();

  if (!vendorProfile) redirect("/login");

  const [{ data: openRfqs }, { data: myQuotes }] = await Promise.all([
    supabase
      .from("rfqs")
      .select(
        "*, process:master_items!rfqs_process_id_fkey(name), material:master_items!rfqs_material_id_fkey(name)"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase.from("quotes").select("rfq_id").eq("vendor_id", vendorProfile.id),
  ]);

  const quotedRfqIds = new Set((myQuotes ?? []).map((q) => q.rfq_id));
  const capabilities = vendorProfile.capabilities ?? [];

  const rfqs = ((openRfqs ?? []) as unknown as RfqRow[]).filter((r) => !quotedRfqIds.has(r.id));

  return (
    <div>
      <Topbar title="RFQ Inbox" pill={{ label: `${rfqs.length} open`, tone: "orange" }} />

      <div className="mt-6">
        <Card>
          {rfqs.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-muted">
              No open RFQs right now. Check back soon.
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Process
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Material
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Quantity
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Tolerance
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Lead Time Pref.
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Received
                  </th>
                  <th className="border-b border-grid px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rfqs.map((r) => {
                  const matches = capabilities.length > 0 && capabilities.includes(r.process?.name ?? "");
                  return (
                    <tr key={r.id}>
                      <td className="border-b border-grid px-5 py-3.5 text-[13px] font-semibold text-ink last:border-b-0">
                        {r.process?.name ?? "—"}
                        {matches && (
                          <span className="ml-2 inline-block">
                            <Badge tone="approved">Matches you</Badge>
                          </span>
                        )}
                      </td>
                      <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                        {r.material?.name ?? "—"}
                      </td>
                      <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                        {r.quantity}
                      </td>
                      <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                        {r.tolerance ?? "—"}
                      </td>
                      <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                        {r.lead_time_pref ?? "—"}
                      </td>
                      <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="border-b border-grid px-5 py-3.5 text-right">
                        <Link
                          href={`/vendor/fabrication/rfqs/${r.id}`}
                          className="rounded-md bg-brand-light px-2.5 py-1.5 text-[12px] font-bold text-brand"
                        >
                          View &amp; Quote
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
