/**
 * Canonical Turning Document (.turncad) & AI Live Chat CAD types.
 * Implements the schema from docs/turning_cad_algorithm_improvement_plan.md.
 */

export type ConfidenceSource = "explicit" | "inferred" | "default_library";

export interface FieldConfidence<T = number | string> {
  value: T;
  confidence: number; // 0.0 to 1.0
  source: ConfidenceSource;
}

export interface SemanticDescriptor {
  owner_feature: string;
  role: string;
  entity_type: "FACE" | "EDGE";
  geometry_type: "CYLINDER" | "PLANE" | "CIRCLE" | "CONE";
  adjacent_surface_types: string[];
  expected_x: number;
  expected_radius: number;
}

export interface ThreadSpec {
  designation: string; // e.g. "M12x1.75", "M20x2.5"
  pitch_mm: number;
  length_mm: number;
  external: boolean;
  tolerance_class: string; // e.g. "6g" or "6H"
}

export interface GrooveSpec {
  width_mm: number;
  depth_mm: number;
  offset_from_start_mm: number;
  type: "OD_GROOVE" | "THREAD_RELIEF" | "ORING_ISO3601";
}

export interface OdSegment {
  id: string;
  label: string;
  diameter_mm: number;
  length_mm: number;
  taper_end_diameter_mm?: number | null;
  chamfer_start_mm: number;
  chamfer_end_mm: number;
  fillet_end_mm: number;
  thread?: ThreadSpec | null;
  groove?: GrooveSpec | null;
  semantic_ref: SemanticDescriptor;
}

export interface BoreSpec {
  enabled: boolean;
  diameter_mm: number;
  depth_mm: number;
  is_through: boolean;
  chamfer_entry_mm: number;
  thread?: ThreadSpec | null;
}

export type MaterialSlug =
  | "steel"
  | "aluminium"
  | "stainless"
  | "brass"
  | "titanium"
  | "delrin"
  | "peek";

export interface MaterialSpec {
  slug: MaterialSlug;
  grade_name: string; // e.g. "EN8 / 080M40", "Al 6061-T6", "SS 304", "Brass C360"
  density_g_cm3: number;
  rate_per_kg_inr: number;
  min_wall_mm: number;
}

export interface TurnedPartDocument {
  id: string;
  version: string;
  part_name: string;
  units: "mm";
  general_tolerance: "ISO 2768-f" | "ISO 2768-m" | "ISO 2768-c";
  surface_finish_ra: number; // e.g. 1.6 or 3.2 um (ISO 21920)
  material: MaterialSpec;
  quantity: number;
  segments: OdSegment[];
  bore: BoreSpec;
  confidence_map: Record<string, FieldConfidence>;
}

export type ValidationSeverity = "error" | "blocker" | "warning" | "info";

export interface DfmQuickFix {
  label: string;
  description: string;
  savings_hint?: string;
  patch: {
    action:
      | "set_bore_diameter"
      | "set_segment_diameter"
      | "set_segment_length"
      | "add_shoulder_fillet"
      | "set_through_bore"
      | "snap_standard_drill";
    segment_id?: string;
    value: number;
  };
}

export interface DfmIssue {
  id: string;
  layer: number; // Tier 1 to Tier 7
  severity: ValidationSeverity;
  code: string;
  title: string;
  message: string;
  feature_ref?: string;
  highlight_x_range?: [number, number];
  highlight_radius?: number;
  quick_fix?: DfmQuickFix;
}

export interface CappSetupScore {
  setup_name: "Setup 1 (Grip Front)" | "Setup 1 (Grip Rear)";
  grip_segment_id: string;
  grip_diameter_mm: number;
  grip_length_mm: number;
  min_required_grip_mm: number;
  slenderness_ratio: number;
  torque_capacity_nm: number;
  score: number;
  feasible: boolean;
  notes: string;
}

export interface CappProcessPlan {
  overall_length_mm: number;
  max_od_mm: number;
  finished_volume_mm3: number;
  finished_area_mm2: number;
  finished_mass_kg: number;
  recommended_stock: {
    standard_diameter_mm: number;
    cut_length_mm: number;
    chuck_grip_allowance_mm: number;
    facing_allowance_mm: number;
    parting_allowance_mm: number;
    stock_volume_mm3: number;
    stock_mass_kg: number;
    removed_Percent: number;
  };
  primary_setup: CappSetupScore;
  secondary_setup_required: boolean;
  operations: {
    step: number;
    setup: 1 | 2;
    operation: string;
    tool: string;
    target_feature: string;
    est_Minutes: number;
  }[];
}

export interface ClarificationQuestion {
  priority: "P0" | "P1" | "P2" | "P3";
  field: string;
  question: string;
  suggestions: { label: string; prompt_to_append: string }[];
}

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  clarifications?: ClarificationQuestion[];
  applied_changes?: string[];
  dfm_count?: { errors: number; warnings: number };
  snapshot_doc?: TurnedPartDocument;
}

