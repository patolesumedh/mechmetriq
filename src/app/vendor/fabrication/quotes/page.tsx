import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatINR, quoteStatusTone } from "../badge-utils";

type QuoteRow = {
  id: string;
  status: "submitted" | "won" | "lost" | "expired" | "withdrawn";
  unit_price: number;
  total_price: number;
  lead_time_days: number;
  validity_date: string;
  created_at: string;
  rfq_id: string;
  rfq: {
    id: string;
    quantity: number;
    process: { name: string } | null;
    material: { name: string } | null;
  } | null;
};

export default async function MyQuotesPage() {
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

  const { data: quotes } = await supabase
    .from("quotes")
    .select(
      "*, rfq:rfqs(id, quantity, process:master_items!rfqs_process_id_fkey(name), material:master_items!rfqs_material_id_fkey(name))"
    )
    .eq("vendor_id", vendorProfile.id)
    .order("created_at", { ascending: false });

  const rows = (quotes ?? []) as unknown as QuoteRow[];

  return (
    <div>
      <Topbar title="My Quotes" pill={{ label: `${rows.length} total`, tone: "brand" }} />

      <div className="mt-6">
        <Card>
          {rows.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-muted">
              You haven&rsquo;t submitted any quotes yet.
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    RFQ
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Unit Price
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Total Price
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Lead Time
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Valid Until
                  </th>
                  <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => (
                  <tr key={q.id}>
                    <td className="border-b border-grid px-5 py-3.5 text-[13px] last:border-b-0">
                      <Link
                        href={`/vendor/fabrication/rfqs/${q.rfq_id}`}
                        className="font-semibold text-ink hover:underline"
                      >
                        {q.rfq?.process?.name ?? "RFQ"} &middot; {q.rfq?.material?.name ?? ""}
                      </Link>
                      <div className="text-[12px] text-muted">Qty {q.rfq?.quantity ?? "—"}</div>
                    </td>
                    <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                      {formatINR(q.unit_price)}
                    </td>
                    <td className="border-b border-grid px-5 py-3.5 text-[13px] font-semibold text-ink">
                      {formatINR(q.total_price)}
                    </td>
                    <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                      {q.lead_time_days} days
                    </td>
                    <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                      {formatDate(q.validity_date)}
                    </td>
                    <td className="border-b border-grid px-5 py-3.5">
                      <Badge tone={quoteStatusTone(q.status)}>{q.status}</Badge>
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
