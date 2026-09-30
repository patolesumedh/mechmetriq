import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CadAnalysisReport } from "@/components/smartQuote/CadAnalysisReport";
import { analysisStatus, isRunning } from "@/components/smartQuote/AnalysisList";
import { AutoRefresh } from "@/components/smartQuote/AutoRefresh";
import type { CadAnalysisResult } from "@/lib/smartQuote/shared";
import { formatDate } from "../../../_lib/format";
import { rerunAnalysisAction } from "../../actions";

// Re-run happens in the background (next/server `after`) within this limit.
export const maxDuration = 300;

export default async function AdminAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient(); // admin layout already checks the role; RLS allows admins

  const { data: row } = await supabase
    .from("cad_analyses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!row) notFound();

  const [{ data: buyer }, { data: signed }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", row.buyer_id).maybeSingle(),
    supabase.storage.from("rfq-attachments").createSignedUrl(row.storage_path, 60 * 10),
  ]);
  const status = analysisStatus(row);

  return (
    <div>
      <AutoRefresh active={isRunning([row])} />
      <Topbar
        title={row.file_name}
        right={
          <form action={rerunAnalysisAction}>
            <input type="hidden" name="analysis_id" value={row.id} />
            <button
              type="submit"
              className="rounded-lg border border-grid px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:bg-plane"
            >
              Re-run analysis
            </button>
          </form>
        }
      />

      <div className="mt-6 flex max-w-[900px] flex-col gap-4">
        <Link href="/admin/quotes" className="text-[12.5px] font-semibold text-brand">
          &larr; Quotes &amp; RFQs
        </Link>

        <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 text-[12.5px] text-ink-2">
          <Badge tone={status.tone}>{status.label}</Badge>
          <span>Buyer: <b className="text-ink">{buyer?.full_name ?? "—"}</b></span>
          <span>RFQ {row.rfq_id.slice(0, 8).toUpperCase()}</span>
          <span>Uploaded {formatDate(row.created_at)}</span>
          <span>Attempts: {row.attempts}</span>
          {signed?.signedUrl && (
            <a href={signed.signedUrl} className="font-semibold text-brand">
              Download STEP
            </a>
          )}
        </Card>

        {row.status === "failed" && row.error && (
          <div className="rounded-lg bg-crit-bg px-4 py-3 text-[13px] font-medium text-[#a12525]">
            {row.error}
          </div>
        )}
        {(row.status === "pending" || row.status === "processing") && (
          <div className="rounded-lg bg-warn-bg px-4 py-3 text-[13px] text-[#8a5a00]">
            {status.label === "Stalled"
              ? "This analysis stopped without finishing. Use Re-run analysis."
              : "Reading the file… this page refreshes by itself."}
          </div>
        )}

        {row.status === "completed" && row.result && (
          <CadAnalysisReport result={row.result as unknown as CadAnalysisResult} />
        )}
      </div>
    </div>
  );
}
