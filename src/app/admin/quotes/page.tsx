import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Th, Td, EmptyRow } from "../_components/table";
import { formatDate, rfqStatusTone, titleCase } from "../_lib/format";
import Link from "next/link";
import { analysisStatus, isRunning } from "@/components/smartQuote/AnalysisList";
import { AutoRefresh } from "@/components/smartQuote/AutoRefresh";
import { isStepFile } from "@/lib/smartQuote/shared";
import { analyseRfqFilesAction } from "./actions";

// "Analyse STEP files" runs in the background (next/server `after`) within this limit.
export const maxDuration = 300;

export default async function AdminQuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ analysing?: string }>;
}) {
  const { analysing } = await searchParams;
  const supabase = await createClient();

  const { data: rfqs } = await supabase
    .from("rfqs")
    .select("id, buyer_id, process_id, material_id, quantity, status, created_at, cad_file_urls")
    .order("created_at", { ascending: false })
    .limit(100);

  const buyerIds = [...new Set((rfqs ?? []).map((r) => r.buyer_id))];
  const masterIds = [
    ...new Set(
      (rfqs ?? []).flatMap((r) => [r.process_id, r.material_id]).filter((v): v is string => !!v)
    ),
  ];
  const rfqIds = (rfqs ?? []).map((r) => r.id);

  let buyers: { id: string; full_name: string }[] = [];
  if (buyerIds.length) {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", buyerIds);
    buyers = data ?? [];
  }

  let masterItems: { id: string; name: string }[] = [];
  if (masterIds.length) {
    const { data } = await supabase.from("master_items").select("id, name").in("id", masterIds);
    masterItems = data ?? [];
  }

  let quotes: { id: string; rfq_id: string }[] = [];
  if (rfqIds.length) {
    const { data } = await supabase.from("quotes").select("id, rfq_id").in("rfq_id", rfqIds);
    quotes = data ?? [];
  }

  let analyses: { id: string; rfq_id: string; file_name: string; status: string; updated_at: string }[] = [];
  if (rfqIds.length) {
    const { data } = await supabase
      .from("cad_analyses")
      .select("id, rfq_id, file_name, status, updated_at")
      .in("rfq_id", rfqIds)
      .order("created_at");
    analyses = data ?? [];
  }
  const analysesByRfq = new Map<string, typeof analyses>();
  for (const a of analyses) {
    analysesByRfq.set(a.rfq_id, [...(analysesByRfq.get(a.rfq_id) ?? []), a]);
  }

  const buyerNameById = new Map(buyers.map((b) => [b.id, b.full_name]));
  const masterNameById = new Map(masterItems.map((m) => [m.id, m.name]));
  const quoteCountByRfq = new Map<string, number>();
  for (const q of quotes) {
    quoteCountByRfq.set(q.rfq_id, (quoteCountByRfq.get(q.rfq_id) ?? 0) + 1);
  }

  return (
    <div>
      <Topbar title="Quotes & RFQs" pill={{ label: `${rfqs?.length ?? 0} RFQs` }} />

      <AutoRefresh active={isRunning(analyses)} />
      {analysing && (
        <div className="mt-6 rounded-lg bg-brand-light px-4 py-3 text-[13px] text-brand-dark">
          Reading the STEP files — results appear in the CAD analysis column as they finish.
        </div>
      )}

      <div className="mt-6">
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Buyer</Th>
                <Th>Process</Th>
                <Th>Material</Th>
                <Th>Qty</Th>
                <Th>Status</Th>
                <Th>CAD analysis</Th>
                <Th>Quotes received</Th>
                <Th>Submitted</Th>
              </tr>
            </thead>
            <tbody>
              {(rfqs ?? []).length === 0 && <EmptyRow colSpan={8}>No RFQs submitted yet.</EmptyRow>}
              {(rfqs ?? []).map((r) => (
                <tr key={r.id}>
                  <Td strong>{buyerNameById.get(r.buyer_id) ?? "—"}</Td>
                  <Td>{r.process_id ? masterNameById.get(r.process_id) ?? "—" : "—"}</Td>
                  <Td>{r.material_id ? masterNameById.get(r.material_id) ?? "—" : "—"}</Td>
                  <Td>{r.quantity}</Td>
                  <Td>
                    <Badge tone={rfqStatusTone(r.status)}>{titleCase(r.status)}</Badge>
                  </Td>
                  <Td>
                    <CadCell
                      rfqId={r.id}
                      rows={analysesByRfq.get(r.id) ?? []}
                      stepFileCount={(r.cad_file_urls ?? []).filter(isStepFile).length}
                    />
                  </Td>
                  <Td>{quoteCountByRfq.get(r.id) ?? 0}</Td>
                  <Td>{formatDate(r.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

function CadCell({
  rfqId,
  rows,
  stepFileCount,
}: {
  rfqId: string;
  rows: { id: string; file_name: string; status: string; updated_at: string }[];
  stepFileCount: number;
}) {
  if (stepFileCount === 0 && rows.length === 0) return <span className="text-muted">No STEP</span>;
  return (
    <div className="flex flex-col items-start gap-1">
      {rows.map((a) => {
        const s = analysisStatus(a);
        return (
          <Link key={a.id} href={`/admin/quotes/analysis/${a.id}`} className="flex items-center gap-1.5">
            <Badge tone={s.tone}>{s.label}</Badge>
            <span className="max-w-[160px] truncate text-[12px] text-brand">{a.file_name}</span>
          </Link>
        );
      })}
      {stepFileCount > rows.length && (
        <form action={analyseRfqFilesAction}>
          <input type="hidden" name="rfq_id" value={rfqId} />
          <button type="submit" className="text-[12px] font-semibold text-brand">
            Analyse {stepFileCount - rows.length} STEP file{stepFileCount - rows.length > 1 ? "s" : ""} &rarr;
          </button>
        </form>
      )}
    </div>
  );
}
