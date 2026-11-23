/**
 * Shared Smart Quote v1 types and helpers (safe for client and server).
 * The shape mirrors services/smartquote/app/analyze.py.
 */

export const STEP_EXTENSIONS = [".step", ".stp"] as const;

export function isStepFile(nameOrPath: string) {
  const lower = nameOrPath.toLowerCase();
  return STEP_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Original file name from a storage path like "<uid>/<timestamp>-<name>". */
export function fileNameFromPath(path: string) {
  const last = path.split("/").pop() ?? path;
  return last.replace(/^\d{10,}-/, "");
}

export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

/** Anything stuck this long in pending/processing is treated as stalled. */
export const STALL_AFTER_MS = 10 * 60 * 1000;

export type Vec3 = [number, number, number];

export interface CadFeature {
  type: string;
  body_id: number | null;
  section: number | null;
  confidence: number | null;
  orientation: string | null;
  faces: number[];
  axis: Vec3 | null;
  position: Vec3 | null;
  details: Record<string, unknown>;
}

export interface CadOperation {
  feature: string;
  tool_family: string | null;
  path: string | null;
  machinability: string;
  machinability_reason: string | null;
  quantity: number | null;
  diameter_mm: number | null;
  depth_mm: number | null;
}

export interface CadTurning {
  body_id: number;
  stock: {
    stock_diameter_mm: number;
    stock_length_mm: number;
    stock_volume_mm3: number;
    finished_volume_mm3: number;
    material_removed_mm3: number;
    material_removed_percent_of_stock: number;
    material_removed_area_mm2: number | null;
  };
  footprint: {
    status: string;
    model_diameter_mm: number;
    model_axial_length_mm: number;
  };
  finished_surface_area_mm2: number;
  operations: CadOperation[];
  overall_machinability: string;
}

export interface CadAnalysisResult {
  analysis_version: string;
  file_name: string;
  processing_ms?: number;
  units: { name: string; symbol: string | null; status: string };
  warnings: string[];
  summary: {
    solid_count: number;
    global_bbox: { x_length: number; y_length: number; z_length: number };
    local_bbox: { x_length: number; y_length: number; z_length: number };
    volume_mm3: number;
    surface_area_mm2: number;
    center_of_mass: Vec3 | null;
    face_type_counts: Record<string, number>;
    primary_axis: Vec3;
  };
  bodies: {
    body_id: number;
    topology_counts: { faces: number; edges: number; vertices: number };
    shell_count: number;
    valid: boolean | null;
  }[];
  feature_sections: { section: number; title: string; features: CadFeature[] }[];
  relationships: {
    relation: string;
    parent: { type: string; faces: number[] };
    child: { type: string; faces: number[] };
  }[];
  turning: CadTurning[];
  feature_count: number;
}

/** Small subset stored in cad_analyses.summary for list views. */
export interface CadAnalysisSummary {
  feature_count: number;
  solid_count: number;
  bbox_mm: Vec3;
  volume_mm3: number;
  surface_area_mm2: number;
  units: string | null;
  stock: { diameter_mm: number; length_mm: number; removed_pct: number } | null;
  machinability: string | null;
  top_features: { type: string; count: number }[];
  warnings: string[];
}

export function buildSummary(r: CadAnalysisResult): CadAnalysisSummary {
  const counts = new Map<string, number>();
  for (const s of r.feature_sections) {
    for (const f of s.features) counts.set(f.type, (counts.get(f.type) ?? 0) + 1);
  }
  const t = r.turning[0];
  const b = r.summary.global_bbox;
  return {
    feature_count: r.feature_count,
    solid_count: r.summary.solid_count,
    bbox_mm: [b.x_length, b.y_length, b.z_length],
    volume_mm3: r.summary.volume_mm3,
    surface_area_mm2: r.summary.surface_area_mm2,
    units: r.units?.symbol ?? null,
    stock: t
      ? {
          diameter_mm: t.stock.stock_diameter_mm,
          length_mm: t.stock.stock_length_mm,
          removed_pct: t.stock.material_removed_percent_of_stock,
        }
      : null,
    machinability: t?.overall_machinability ?? null,
    top_features: [...counts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    warnings: r.warnings ?? [],
  };
}

export function featureLabel(type: string) {
  return type
    .replace(/_CANDIDATE$/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
    .replace(/\bod\b/i, "OD")
    .replace(/\bid\b/i, "ID");
}

export function fmtMm(n: number | null | undefined, digits = 1) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toLocaleString("en-IN", { maximumFractionDigits: digits })}`;
}

export function fmtVolumeCm3(mm3: number | null | undefined) {
  if (mm3 === null || mm3 === undefined) return "—";
  return `${(mm3 / 1000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} cm³`;
}

export function fmtAreaCm2(mm2: number | null | undefined) {
  if (mm2 === null || mm2 === undefined) return "—";
  return `${(mm2 / 100).toLocaleString("en-IN", { maximumFractionDigits: 1 })} cm²`;
}

export function isStalled(status: string, updatedAt: string) {
  return (
    (status === "pending" || status === "processing") &&
    Date.now() - new Date(updatedAt).getTime() > STALL_AFTER_MS
  );
}
