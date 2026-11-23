import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import {
  featureLabel,
  fmtMm,
  fmtVolumeCm3,
  isStalled,
  type CadAnalysisSummary,
} from "@/lib/smartQuote/shared";

export interface AnalysisRow {
  id: string;
  file_name: string;
  status: string;
  error: string | null;
  summary: unknown;
  updated_at: string;
}

export function analysisStatus(row: Pick<AnalysisRow, "status" | "updated_at">): {
  tone: BadgeTone;
  label: string;
} {
  if (isStalled(row.status, row.updated_at)) return { tone: "rejected", label: "Stalled" };
  switch (row.status) {
    case "completed":
      return { tone: "approved", label: "Analysed" };
    case "failed":
      return { tone: "rejected", label: "Couldn't read" };
    case "processing":
      return { tone: "quoted", label: "Reading…" };
    default:
      return { tone: "pending", label: "Queued" };
  }
}

export function isRunning(rows: Pick<AnalysisRow, "status" | "updated_at">[]) {
  return rows.some(
    (r) => (r.status === "pending" || r.status === "processing") && !isStalled(r.status, r.updated_at)
  );
}

/** Compact list of a quote's STEP analyses, each linking to its full report. */
export function AnalysisList({
  rows,
  hrefFor,
}: {
  rows: AnalysisRow[];
  hrefFor: (id: string) => string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="border-b border-grid px-5 py-3.5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Part analysis (Smart Quote v1)
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const s = row.summary as CadAnalysisSummary | null;
          const status = analysisStatus(row);
          return (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-plane px-3 py-2.5 text-[12.5px]"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-ink">{row.file_name}</div>
                {row.status === "completed" && s ? (
                  <div className="text-muted">
                    {s.bbox_mm.map((v) => fmtMm(v)).join(" × ")} mm · {fmtVolumeCm3(s.volume_mm3)} ·{" "}
                    {s.feature_count} features
                    {s.top_features.length > 0 &&
                      ` (${s.top_features
                        .slice(0, 3)
                        .map((f) => `${f.count}× ${featureLabel(f.type).toLowerCase()}`)
                        .join(", ")})`}
                  </div>
                ) : row.status === "failed" && row.error ? (
                  <div className="text-[#a12525]">{row.error}</div>
                ) : null}
              </div>
              <div className="flex flex-none items-center gap-2.5">
                <Badge tone={status.tone}>{status.label}</Badge>
                {row.status === "completed" && (
                  <Link href={hrefFor(row.id)} className="text-[12px] font-semibold text-brand">
                    View report &rarr;
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
