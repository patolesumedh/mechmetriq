import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatInr, type Estimate } from "@/lib/smartQuote/pricing";
import { formatDate, rfqStatusTone, titleCase } from "../../_lib/format";
import { confirmPriceAction } from "../actions";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 px-5 py-2.5 text-[13px]">
      <span className="text-muted">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}

const fileName = (p: string) => p.split("/").pop()?.replace(/^\d{10,}-/, "") ?? p;

export default async function AdminRfqPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ confirmed?: string; error?: string }>;
}) {
  const { id } = await params;
  const { confirmed, error } = await searchParams;
  const supabase = await createClient(); // admin layout checks the role

  const { data: rfq } = await supabase.from("rfqs").select("*").eq("id", id).maybeSingle();
  if (!rfq) notFound();

  const [{ data: buyer }, { data: grade }, { data: analysis }, { data: signed }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", rfq.buyer_id).maybeSingle(),
    rfq.rm_grade_id
      ? supabase.from("rm_grades").select("name").eq("id", rfq.rm_grade_id).maybeSingle()
      : Promise.resolve({ data: null }),
    rfq.analysis_id
      ? supabase.from("cad_analyses").select("id, status, thumbnail_path").eq("id", rfq.analysis_id).maybeSingle()
      : Promise.resolve({ data: null }),
    (rfq.cad_file_urls ?? []).length
      ? supabase.storage.from("rfq-attachments").createSignedUrls(rfq.cad_file_urls ?? [], 60 * 10)
      : Promise.resolve({ data: [] as { signedUrl: string }[] }),
  ]);
  const thumb = analysis?.thumbnail_path
    ? (await supabase.storage.from("rfq-attachments").createSignedUrl(analysis.thumbnail_path, 600)).data?.signedUrl
    : null;

  const est = rfq.estimate as unknown as Estimate | null;
  const tier = est?.tiers.find((t) => t.key === rfq.price_tier);
  const defaultUnit = rfq.confirmed_unit_price ?? rfq.estimated_unit_price ?? "";
  const defaultLead = rfq.confirmed_lead_days ?? rfq.estimated_lead_days ?? 10;

  return (
    <div>
      <Topbar
        title={`RFQ ${rfq.id.slice(0, 8).toUpperCase()}`}
        pill={{ label: rfq.price_status === "confirmed" ? "Price confirmed" : rfq.price_status === "estimated" ? "Estimate — needs review" : "Needs pricing", tone: rfq.price_status === "confirmed" ? "brand" : "orange" }}
      />
      <div className="mt-6 flex max-w-[1000px] flex-col gap-4">
        <Link href="/admin/quotes" className="text-[12.5px] font-semibold text-brand">
          &larr; Quotes &amp; RFQs
        </Link>
        {confirmed && (
          <div className="rounded-lg bg-good-bg px-4 py-3 text-[13px] font-medium text-[#0a6b0a]">
            Price confirmed — the buyer now sees it on My Quotes.
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-crit-bg px-4 py-3 text-[13px] font-medium text-[#a12525]">
            {error === "invalid" ? "Enter a unit price above 0 and lead time of 1–365 days." : "Couldn't save. Try again."}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader title="Request" />
            <div className="flex gap-4 border-b border-grid px-5 py-4">
              {thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="Part preview" className="h-24 w-24 flex-none rounded-lg border border-grid bg-plane object-contain" />
              )}
              <div className="text-[13px] text-ink-2">
                <div className="font-semibold text-ink">{buyer?.full_name ?? "—"}</div>
                <div>Submitted {formatDate(rfq.created_at)}</div>
                <div className="mt-1">
                  <Badge tone={rfqStatusTone(rfq.status)}>{titleCase(rfq.status)}</Badge>
                </div>
                {analysis?.status === "completed" && (
                  <Link href={`/admin/quotes/analysis/${analysis.id}`} className="mt-1 inline-block font-semibold text-brand">
                    CAD analysis &rarr;
                  </Link>
                )}
              </div>
            </div>
            <div className="divide-y divide-grid">
              <Row label="Material" value={grade?.name ?? "—"} />
              <Row label="Quantity" value={rfq.quantity} />
              <Row label="Finish" value={rfq.surface_finish ?? "—"} />
              <Row label="Tolerance" value={rfq.tolerance ?? "—"} />
              <Row label="Roughness" value={rfq.surface_roughness ?? "—"} />
              <Row label="Threads / inserts" value={`${rfq.threads_qty ?? 0} / ${rfq.inserts_qty ?? 0}`} />
              <Row label="Inspection" value={rfq.inspection ?? "—"} />
              <Row label="Certificates" value={(rfq.certificates ?? []).join(", ") || "—"} />
              <Row label="Lead time chosen" value={rfq.lead_time_pref ?? "—"} />
              <Row label="Notes" value={rfq.special_instructions ?? "—"} />
              <Row
                label="Files"
                value={
                  <span className="flex flex-col items-end">
                    {(signed ?? []).map((f, i) =>
                      f.signedUrl ? (
                        <a key={i} href={f.signedUrl} className="text-brand">
                          {fileName((rfq.cad_file_urls ?? [])[i])}
                        </a>
                      ) : null
                    )}
                  </span>
                }
              />
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader title={rfq.price_status === "confirmed" ? "Confirmed price" : "Confirm price"} />
              <form action={confirmPriceAction} className="flex flex-col gap-3 p-5">
                <input type="hidden" name="rfq_id" value={rfq.id} />
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-[12px] font-semibold text-ink-2">
                    Unit price (₹, excl. GST)
                    <input name="unit_price" type="number" step="0.01" min="0.01" defaultValue={defaultUnit} required
                      className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-[13.5px]" />
                  </label>
                  <label className="text-[12px] font-semibold text-ink-2">
                    Lead time (working days)
                    <input name="lead_days" type="number" min="1" max="365" defaultValue={defaultLead} required
                      className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-[13.5px]" />
                  </label>
                </div>
                <label className="text-[12px] font-semibold text-ink-2">
                  Note to buyer (optional)
                  <input name="note" defaultValue={rfq.price_note ?? ""} maxLength={300}
                    className="mt-1 w-full rounded-lg border border-grid px-3 py-2 text-[13.5px]" />
                </label>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted">Total = unit price × {rfq.quantity}</span>
                  <button type="submit" className="rounded-lg bg-brand px-4 py-2.5 text-[13px] font-bold text-white">
                    {rfq.price_status === "confirmed" ? "Update price" : "Confirm price"}
                  </button>
                </div>
              </form>
            </Card>

            {est && (
              <Card>
                <CardHeader title="How the estimate was built" />
                <div className="divide-y divide-grid">
                  <Row label="Estimate (tier)" value={`${formatInr(Number(rfq.estimated_total ?? 0))} · ${tier?.label ?? rfq.price_tier} · ${rfq.estimated_lead_days} days`} />
                  <Row label="Route / stock" value={`${est.route} · ${est.stock.kind} ${est.stock.dims_mm.join(" × ")} mm · ${est.stock.weight_kg} kg`} />
                  <Row label="Material rate" value={`${est.grade.name} @ ${formatInr(est.grade.rate_per_kg)}/kg`} />
                  <Row label="Per part: material" value={formatInr(est.per_part.material, 2)} />
                  <Row label="Per part: machining" value={`${formatInr(est.per_part.machining, 2)} (${est.per_part.cycle_min} min)`} />
                  <Row label="Cycle breakdown (min)" value={Object.entries(est.per_part.breakdown_min).map(([k, v]) => `${k} ${v}`).join(" · ")} />
                  {est.per_part.finish > 0 && <Row label="Per part: finish" value={formatInr(est.per_part.finish, 2)} />}
                  <Row label="Setup + programming (order)" value={formatInr(est.per_order.setup_programming)} />
                  {est.per_order.inspection > 0 && <Row label="Inspection (order)" value={formatInr(est.per_order.inspection)} />}
                  {est.per_order.certificates > 0 && <Row label="Certificates (order)" value={formatInr(est.per_order.certificates)} />}
                  {est.per_order.finish_lot > 0 && <Row label="Finishing lot charge" value={formatInr(est.per_order.finish_lot)} />}
                  <Row label="Cost before margin" value={`${formatInr(est.subtotal_before_margin)} · margin ${est.margin_pct}%`} />
                  <Row label="All tiers" value={est.tiers.map((t) => `${t.label} ${formatInr(t.total)}`).join(" · ")} />
                  {est.notes.length > 0 && <Row label="Notes" value={est.notes.join(" ")} />}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
