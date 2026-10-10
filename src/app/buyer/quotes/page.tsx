import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { QuotesCartTabs } from "@/components/buyer/QuotesCartTabs";
import type { Tables } from "@/lib/types/database";
import { AnalysisList, isRunning, type AnalysisRow } from "@/components/smartQuote/AnalysisList";
import { AutoRefresh } from "@/components/smartQuote/AutoRefresh";
import { PriceBlock } from "@/components/smartQuote/PriceBlock";
import { quoteValidity } from "@/lib/smartQuote/validity";
import {
  formatCurrency,
  formatDate,
  quoteStatusTone,
  rfqStatusTone,
  statusLabel,
} from "../_lib/ui";

function addDaysIso(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { submitted } = await searchParams;
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

  const { count: cartCount } = await supabase
    .from("rm_cart_items")
    .select("id", { count: "exact", head: true })
    .eq("buyer_id", user.id);

  const allRfqs = rfqs ?? [];
  const rfqIds = allRfqs.map((r) => r.id);

  const { data: quotes } = await supabase
    .from("quotes")
    .select("*")
    .in("rfq_id", rfqIds)
    .order("total_price", { ascending: true });
  const allQuotes = quotes ?? [];

  const { data: analyses } = await supabase
    .from("cad_analyses")
    .select("id, rfq_id, file_name, status, error, summary, updated_at")
    .in("rfq_id", rfqIds)
    .order("created_at", { ascending: true });
  const analysesByRfq = new Map<string, AnalysisRow[]>();
  for (const a of analyses ?? []) {
    if (!a.rfq_id) continue;
    const list = analysesByRfq.get(a.rfq_id) ?? [];
    list.push(a);
    analysesByRfq.set(a.rfq_id, list);
  }

  const itemIds = Array.from(
    new Set(
      allRfqs.flatMap((r) => [r.process_id, r.material_id]).filter((v): v is string => Boolean(v))
    )
  );
  const { data: items } = await supabase.from("master_items").select("id, name").in("id", itemIds);
  const itemMap = new Map((items ?? []).map((i) => [i.id, i.name]));
  const gradeIds = Array.from(new Set(allRfqs.map((r) => r.rm_grade_id).filter((v): v is string => !!v)));
  const { data: gradeRows } = gradeIds.length
    ? await supabase.from("rm_grades").select("id, name").in("id", gradeIds)
    : { data: [] as { id: string; name: string }[] };
  const gradeMap = new Map((gradeRows ?? []).map((g) => [g.id, g.name]));

  const { data: placedOrders } = rfqIds.length
    ? await supabase.from("orders").select("id, order_number, source_rfq_id").in("source_rfq_id", rfqIds)
    : { data: [] as { id: string; order_number: string; source_rfq_id: string | null }[] };
  const orderByRfq = new Map((placedOrders ?? []).map((o) => [o.source_rfq_id, o]));

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
        <Topbar title="Quotes & Cart" />
      </div>
      <QuotesCartTabs
        active="quotes"
        quotesCount={allRfqs.length || undefined}
        cartCount={cartCount || undefined}
      />
      <AutoRefresh active={isRunning(analyses ?? [])} />
      {submitted && (
        <div className="mb-4 rounded-lg bg-good-bg px-4 py-3 text-[13px] font-medium text-[#0a6b0a]">
          Request sent for {submitted} part{submitted === "1" ? "" : "s"}. Our team will confirm the price shortly.
        </div>
      )}

      {allRfqs.length > 0 ? (
        <div className="flex flex-col gap-4">
          {allRfqs.map((rfq) => {
            const rfqQuotes = quotesByRfq.get(rfq.id) ?? [];
            const fileName = (rfq.cad_file_urls ?? [])[0]?.split("/").pop()?.replace(/^\d{10,}-/, "");
            const title = [
              fileName,
              itemMap.get(rfq.process_id ?? ""),
              rfq.rm_grade_id ? gradeMap.get(rfq.rm_grade_id) : rfq.material_id ? itemMap.get(rfq.material_id) : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Custom part RFQ";

            return (
              <Card key={rfq.id}>
                <CardHeader title={title} />
                <div className="flex items-center justify-between border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                  <span>
                    Qty {rfq.quantity} · Submitted {formatDate(rfq.created_at)}
                    <br />
                    <span className="text-[12px]">
                      {rfq.status === "accepted"
                        ? "Quote accepted and paid."
                        : rfq.price_status === "confirmed" && rfq.confirmed_at
                          ? `Price valid for 7 days from confirmation — until ${formatDate(addDaysIso(rfq.confirmed_at, 7))}.`
                          : "Once our team confirms the price, it stays valid for 7 days."}
                    </span>
                  </span>
                  <Badge tone={rfqStatusTone(rfq.status)}>{statusLabel(rfq.status)}</Badge>
                </div>
                <PriceBlock rfq={rfq} />
                <OrderAction
                  rfq={rfq}
                  order={orderByRfq.get(rfq.id) ?? null}
                  {...quoteValidity(rfq.confirmed_at)}
                />
                <AnalysisList
                  rows={analysesByRfq.get(rfq.id) ?? []}
                  hrefFor={(id) => `/buyer/quotes/analysis/${id}`}
                />
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
                        </div>
                      </div>
                    ))}
                  </div>
                ) : rfq.price_status === "none" ? (
                  <div className="px-5 py-5 text-[13px] text-ink-2">Our team is preparing your price.</div>
                ) : null}
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

function OrderAction({
  rfq,
  order,
  validUntil,
  expired,
}: {
  rfq: Tables<"rfqs">;
  order: { id: string; order_number: string } | null;
  validUntil: string | null;
  expired: boolean;
}) {
  if (order) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grid px-5 py-3 text-[13px]">
        <span className="text-ink-2">
          Order <b className="text-ink">{order.order_number}</b> placed and paid.
        </span>
        <ButtonLink href={`/buyer/orders/${order.id}`} variant="outline">
          View order
        </ButtonLink>
      </div>
    );
  }
  if (rfq.price_status !== "confirmed" || rfq.status !== "quoted" || rfq.confirmed_total == null) return null;
  if (expired) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grid bg-crit-bg/50 px-5 py-3 text-[13px]">
        <span className="text-[#a12525]">This price expired on {formatDate(validUntil)}. Request a new quote to order.</span>
        <ButtonLink href="/buyer/quote" variant="outline">
          Get a new quote
        </ButtonLink>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grid px-5 py-3 text-[13px]">
      <span className="text-ink-2">
        Total with 18% GST{" "}
        <b className="text-ink">{formatCurrency(Math.round(Number(rfq.confirmed_total) * 118) / 100)}</b>
        {validUntil ? ` · order by ${formatDate(validUntil)}` : ""}
      </span>
      <ButtonLink href={`/buyer/quotes/${rfq.id}/checkout`}>Accept &amp; pay</ButtonLink>
    </div>
  );
}
