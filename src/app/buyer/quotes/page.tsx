import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import type { Tables } from "@/lib/types/database";
import { acceptQuoteAction } from "./actions";
import {
  formatCurrency,
  formatDate,
  quoteStatusTone,
  rfqStatusTone,
  statusLabel,
} from "../_lib/ui";

export default async function QuotesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rfqs } = await supabase
    .from("rfqs")
    .select("*")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });

  const allRfqs = rfqs ?? [];
  const rfqIds = allRfqs.map((r) => r.id);

  const { data: quotes } = await supabase
    .from("quotes")
    .select("*")
    .in("rfq_id", rfqIds)
    .order("total_price", { ascending: true });
  const allQuotes = quotes ?? [];

  const itemIds = Array.from(
    new Set(
      allRfqs.flatMap((r) => [r.process_id, r.material_id]).filter((v): v is string => Boolean(v))
    )
  );
  const { data: items } = await supabase.from("master_items").select("id, name").in("id", itemIds);
  const itemMap = new Map((items ?? []).map((i) => [i.id, i.name]));

  const vendorIds = Array.from(new Set(allQuotes.map((q) => q.vendor_id)));
  const { data: vendors } = await supabase
    .from("vendor_profiles")
    .select("id, company_name")
    .in("id", vendorIds);
  const vendorMap = new Map((vendors ?? []).map((v) => [v.id, v.company_name]));

  const quotesByRfq = new Map<string, Tables<"quotes">[]>();
  for (const q of allQuotes) {
    const list = quotesByRfq.get(q.rfq_id) ?? [];
    list.push(q);
    quotesByRfq.set(q.rfq_id, list);
  }

  return (
    <>
      <div className="-mx-7 -mt-7 mb-7">
        <Topbar title="My Quotes" />
      </div>

      {allRfqs.length > 0 ? (
        <div className="flex flex-col gap-4">
          {allRfqs.map((rfq) => {
            const rfqQuotes = quotesByRfq.get(rfq.id) ?? [];
            const title = [itemMap.get(rfq.process_id ?? ""), rfq.material_id ? itemMap.get(rfq.material_id) : null]
              .filter(Boolean)
              .join(" · ") || "Custom part RFQ";

            return (
              <Card key={rfq.id}>
                <CardHeader title={title} />
                <div className="flex items-center justify-between border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                  <span>
                    Qty {rfq.quantity} · Submitted {formatDate(rfq.created_at)}
                  </span>
                  <Badge tone={rfqStatusTone(rfq.status)}>{statusLabel(rfq.status)}</Badge>
                </div>
                {rfqQuotes.length > 0 ? (
                  <div className="divide-y divide-grid">
                    {rfqQuotes.map((quote) => (
                      <div
                        key={quote.id}
                        className="flex items-center justify-between px-5 py-3.5 text-[13.5px]"
                      >
                        <div>
                          <div className="font-semibold text-ink">
                            {vendorMap.get(quote.vendor_id) ?? "Vendor"}
                          </div>
                          <div className="text-[12px] text-muted">
                            {formatCurrency(quote.unit_price)}/unit · Total{" "}
                            {formatCurrency(quote.total_price)} · Lead time {quote.lead_time_days}{" "}
                            days · Valid till {formatDate(quote.validity_date)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge tone={quoteStatusTone(quote.status)}>
                            {statusLabel(quote.status)}
                          </Badge>
                          {quote.status === "submitted" && rfq.status !== "accepted" && (
                            <form action={acceptQuoteAction}>
                              <input type="hidden" name="quote_id" value={quote.id} />
                              <input type="hidden" name="rfq_id" value={rfq.id} />
                              <button
                                type="submit"
                                className="rounded-lg bg-brand px-3.5 py-2 text-[12.5px] font-bold text-white"
                              >
                                Accept Quote
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-6 text-[13px] text-ink-2">Awaiting vendor quotes.</div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-3 px-5 py-14 text-center">
          <p className="text-[13.5px] text-ink-2">You haven&rsquo;t submitted any RFQs yet.</p>
          <ButtonLink href="/buyer/quote">Get Instant Quote</ButtonLink>
        </Card>
      )}
    </>
  );
}
