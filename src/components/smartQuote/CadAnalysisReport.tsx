import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  featureLabel,
  fmtAreaCm2,
  fmtMm,
  fmtVolumeCm3,
  type CadAnalysisResult,
  type CadFeature,
} from "@/lib/smartQuote/shared";

/** Detail keys worth showing per feature, in display order. */
const DETAIL_FIELDS: [key: string, label: string, unit?: string][] = [
  ["diameter_mm", "Ø", "mm"],
  ["large_diameter_mm", "Large Ø", "mm"],
  ["small_diameter_mm", "Small Ø", "mm"],
  ["depth_mm", "Depth", "mm"],
  ["axial_length_mm", "Length", "mm"],
  ["length_mm", "Length", "mm"],
  ["width_mm", "Width", "mm"],
  ["height_mm", "Height", "mm"],
  ["radius_mm", "R", "mm"],
  ["angle_deg", "Angle", "°"],
  ["cone_angle_deg", "Angle", "°"],
  ["minimum_thickness_mm", "Thickness", "mm"],
  ["floor_area_mm2", "Floor area", "mm²"],
  ["quantity", "Qty"],
];

function featureDims(f: CadFeature) {
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const [key, label, unit] of DETAIL_FIELDS) {
    const v = f.details?.[key];
    if (typeof v !== "number" || seen.has(label)) continue;
    seen.add(label);
    parts.push(`${label} ${fmtMm(v, 2)}${unit ? ` ${unit}` : ""}`);
  }
  return parts.join(" · ") || "—";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-plane px-3.5 py-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-[15px] font-bold text-ink">{value}</div>
    </div>
  );
}

function machinabilityTone(text: string) {
  return text.startsWith("MACHINABLE") ? "approved" : text.startsWith("DIFFICULT") ? "review" : "rejected";
}

export function CadAnalysisReport({ result }: { result: CadAnalysisResult }) {
  const s = result.summary;
  const b = s.global_bbox;
  const sections = result.feature_sections.filter((sec) => sec.features.length > 0);
  const faceCounts = Object.entries(s.face_type_counts).filter(([, n]) => n > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-brand-light px-4 py-3 text-[12.5px] text-brand-dark">
        Read automatically from your STEP file by Smart Quote v1. Feature names ending in
        &ldquo;candidate&rdquo; are likely but unconfirmed; our engineers review every part before
        the price is final.
      </div>

      {result.warnings.length > 0 && (
        <div className="rounded-lg bg-warn-bg px-4 py-3 text-[12.5px] text-[#8a5a00]">
          {result.warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader title="Part summary" />
        <div className="grid grid-cols-2 gap-2.5 p-5 sm:grid-cols-4">
          <Stat
            label="Size (X × Y × Z)"
            value={`${fmtMm(b.x_length)} × ${fmtMm(b.y_length)} × ${fmtMm(b.z_length)} mm`}
          />
          <Stat label="Volume" value={fmtVolumeCm3(s.volume_mm3)} />
          <Stat label="Surface area" value={fmtAreaCm2(s.surface_area_mm2)} />
          <Stat
            label="Features found"
            value={`${result.feature_count}${s.solid_count > 1 ? ` · ${s.solid_count} bodies` : ""}`}
          />
        </div>
        {faceCounts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-grid px-5 py-3 text-[11.5px] text-ink-2">
            <span className="mr-1 font-semibold text-muted">Surfaces:</span>
            {faceCounts.map(([type, n]) => (
              <span key={type} className="rounded-full bg-plane px-2 py-0.5">
                {n} {type.toLowerCase()}
              </span>
            ))}
          </div>
        )}
      </Card>

      {result.turning.map((t) => (
        <Card key={t.body_id}>
          <CardHeader
            title={`Stock & machining plan${result.turning.length > 1 ? ` — body ${t.body_id}` : ""}`}
          />
          <div className="grid grid-cols-2 gap-2.5 p-5 sm:grid-cols-4">
            <Stat
              label="Round-bar stock"
              value={`Ø${fmtMm(t.stock.stock_diameter_mm)} × ${fmtMm(t.stock.stock_length_mm)} mm`}
            />
            <Stat
              label="Material removed"
              value={`${fmtMm(t.stock.material_removed_percent_of_stock)}%`}
            />
            <Stat label="Removed volume" value={fmtVolumeCm3(t.stock.material_removed_mm3)} />
            <Stat label="Operations" value={String(t.operations.length)} />
          </div>
          <div className="flex items-center gap-2 border-t border-grid px-5 py-3 text-[12.5px]">
            <Badge tone={machinabilityTone(t.overall_machinability)}>
              {t.overall_machinability.startsWith("MACHINABLE") ? "Machinable" : "Needs review"}
            </Badge>
            <span className="text-ink-2">
              {t.overall_machinability.charAt(0) + t.overall_machinability.slice(1).toLowerCase()}
            </span>
          </div>
          {t.operations.length > 0 && (
            <details className="border-t border-grid">
              <summary className="cursor-pointer px-5 py-3 text-[12.5px] font-semibold text-brand">
                Planned operation sequence
              </summary>
              <ol className="divide-y divide-grid border-t border-grid">
                {t.operations.map((o, i) => (
                  <li key={i} className="flex flex-wrap items-start justify-between gap-2 px-5 py-2.5 text-[12.5px]">
                    <div>
                      <span className="mr-2 text-muted">{i + 1}.</span>
                      <span className="font-semibold text-ink">{featureLabel(o.feature)}</span>
                      {o.quantity ? <span className="text-muted"> × {o.quantity}</span> : null}
                      <div className="ml-5 text-muted">
                        {[o.tool_family, o.path].filter(Boolean).join(" · ").toLowerCase()}
                      </div>
                    </div>
                    <Badge tone={machinabilityTone(o.machinability)}>
                      {o.machinability.startsWith("MACHINABLE") ? "OK" : "Check"}
                    </Badge>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </Card>
      ))}

      <Card>
        <CardHeader title="Features" />
        {sections.length === 0 ? (
          <div className="px-5 py-6 text-[13px] text-ink-2">No machining features recognised.</div>
        ) : (
          <div className="divide-y divide-grid">
            {sections.map((sec) => (
              <details key={sec.section} open={sec.section === 8}>
                <summary className="flex cursor-pointer items-center justify-between px-5 py-3 text-[13px]">
                  <span className="font-semibold text-ink">{sec.title}</span>
                  <span className="text-[12px] text-muted">{sec.features.length}</span>
                </summary>
                <div className="overflow-x-auto border-t border-grid">
                  <table className="w-full min-w-[520px] text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[10.5px] uppercase tracking-wide text-muted">
                        <th className="px-5 py-2 font-semibold">Feature</th>
                        <th className="px-3 py-2 font-semibold">Dimensions</th>
                        <th className="px-3 py-2 font-semibold">Direction</th>
                        <th className="px-5 py-2 text-right font-semibold">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sec.features.map((f, i) => (
                        <tr key={i} className="border-t border-grid">
                          <td className="px-5 py-2 font-medium text-ink">
                            {featureLabel(f.type)}
                            {f.type.endsWith("_CANDIDATE") && (
                              <span className="ml-1.5 text-[10.5px] font-semibold text-muted">candidate</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-ink-2">{featureDims(f)}</td>
                          <td className="px-3 py-2 text-ink-2">
                            {f.orientation ? f.orientation.toLowerCase() : "—"}
                          </td>
                          <td className="px-5 py-2 text-right text-ink-2">
                            {typeof f.confidence === "number" ? `${Math.round(f.confidence * 100)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        )}
      </Card>

      <p className="text-[11.5px] text-muted">
        {result.analysis_version}
        {result.units?.symbol ? ` · units: ${result.units.symbol}` : ""}
        {typeof result.processing_ms === "number"
          ? ` · read in ${(result.processing_ms / 1000).toFixed(1)} s`
          : ""}
      </p>
    </div>
  );
}
