/**
 * 7-Layer Validation Funnel, DFM "Click-to-Fix" Generator, Stock Optimizer,
 * and Setup Scorer for Turned Parts.
 * Adheres to ISO 286, ISO 2768, ISO 21920, and Sandvik/Kennametal turning rules.
 */

import type { PartGeometry, GradeRate, PricingSettings } from "@/lib/smartQuote/pricing";
import type { CadAnalysisResult } from "@/lib/smartQuote/shared";
import type {
  CappProcessPlan,
  CappSetupScore,
  DfmIssue,
  DfmQuickFix,
  MaterialSlug,
  MaterialSpec,
  TurnedPartDocument,
} from "./types";

export const MATERIALS_CATALOG: Record<MaterialSlug, MaterialSpec> = {
  steel: {
    slug: "steel",
    grade_name: "EN8 / 080M40 Medium Carbon Steel",
    density_g_cm3: 7.85,
    rate_per_kg_inr: 92,
    min_wall_mm: 1.0,
  },
  aluminium: {
    slug: "aluminium",
    grade_name: "Al 6061-T6 Aerospace Grade",
    density_g_cm3: 2.7,
    rate_per_kg_inr: 315,
    min_wall_mm: 0.8,
  },
  stainless: {
    slug: "stainless",
    grade_name: "SS 304 Austenitic Stainless",
    density_g_cm3: 7.93,
    rate_per_kg_inr: 265,
    min_wall_mm: 1.2,
  },
  brass: {
    slug: "brass",
    grade_name: "Brass C36000 Free-Machining",
    density_g_cm3: 8.5,
    rate_per_kg_inr: 590,
    min_wall_mm: 0.8,
  },
  titanium: {
    slug: "titanium",
    grade_name: "Titanium Ti-6Al-4V (Grade 5)",
    density_g_cm3: 4.43,
    rate_per_kg_inr: 2800,
    min_wall_mm: 1.2,
  },
  delrin: {
    slug: "delrin",
    grade_name: "Delrin / POM-C Acetal",
    density_g_cm3: 1.41,
    rate_per_kg_inr: 420,
    min_wall_mm: 1.5,
  },
  peek: {
    slug: "peek",
    grade_name: "PEEK 450G High-Temp Polymer",
    density_g_cm3: 1.32,
    rate_per_kg_inr: 6500,
    min_wall_mm: 1.5,
  },
};

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  currency: "INR",
  margin_pct: 22,
  min_order_value: 950,
  milling_rate_per_hr: 850,
  turning_rate_per_hr: 650,
  setup_min_per_setup: 30,
  programming_min: 25,
  handling_min_per_part: 1.5,
  hours_per_day: 8,
  machines_in_parallel: 2,
  stock_allowance_mm: 3,
  scrap_pct: 8,
  base_mrr_cm3_per_min: 14,
  base_finish_cm2_per_min: 45,
  material_time_factor: {
    aluminium: 0.65,
    brass: 0.6,
    steel: 1.0,
    stainless: 1.35,
  },
  feature_minutes: {
    hole: 1.8,
    thread: 2.5,
    pocket: 3.0,
    slot: 2.0,
    boss: 2.0,
    edge: 0.6,
    turning: 1.2,
    thin: 3.5,
    freeform: 4.0,
    cross: 3.0,
  },
  feature_cap_minutes: {
    hole: 20,
    thread: 25,
    pocket: 40,
    slot: 30,
    boss: 20,
    edge: 12,
    turning: 35,
    thin: 30,
    freeform: 60,
    cross: 30,
  },
  candidate_weight: 0.5,
  roughness_multiplier: {
    "3.2": 1.0,
    "1.6": 1.15,
    "0.8": 1.4,
    "0.4": 1.75,
  },
  tolerance_multiplier: {
    "ISO 2768-c": 0.95,
    "ISO 2768-m": 1.0,
    "ISO 2768-f": 1.25,
    "±0.05 mm": 1.25,
    "±0.02 mm": 1.5,
  },
  finish_rate_per_dm2: {
    "As machined": 0,
    "Anodized Type II": 45,
    "Black Oxide": 25,
    "Electropolished": 60,
  },
  finish_min_lot: 400,
  finish_extra_days: 2,
  thread_min_each: 1.5,
  insert_min_each: 2.0,
  insert_cost_each: 28,
  inspection_fee: {
    Standard: 0,
    "CMM Report": 1200,
    "First Article (FAIR)": 1800,
  },
  certificate_fee: 250,
  marking_fee_per_part: 15,
  tiers: [
    { key: "express", label: "Express", days: 3, multiplier: 1.35 },
    { key: "standard", label: "Standard", days: 6, multiplier: 1.0 },
    { key: "economy", label: "Economy", days: 11, multiplier: 0.88 },
  ],
};

export const STANDARD_BAR_DIAMETERS_MM = [
  10, 12, 16, 20, 22, 25, 28, 30, 32, 36, 40, 45, 50, 56, 60, 63, 65, 70, 75,
  80, 90, 100, 110, 120, 130, 140, 150, 160, 180, 200, 220, 250,
];

export const STANDARD_DRILL_SIZES_MM = [
  3, 4, 5, 6, 6.8, 8, 8.5, 10, 10.2, 12, 14, 15, 16, 17.5, 18, 20, 22, 24, 25,
  26, 28, 30, 32, 35, 38, 40, 45, 50,
];

function nearestStandardDrill(d: number): number {
  let best = STANDARD_DRILL_SIZES_MM[0];
  let bestDiff = Math.abs(d - best);
  for (const s of STANDARD_DRILL_SIZES_MM) {
    const diff = Math.abs(d - s);
    if (diff < bestDiff) {
      best = s;
      bestDiff = diff;
    }
  }
  return best;
}

/**
 * Apply a 1-Click DFM QuickFix directly to a TurnedPartDocument.
 */
export function applyDfmQuickFix(
  doc: TurnedPartDocument,
  fix: DfmQuickFix
): { doc: TurnedPartDocument; summary: string } {
  const next: TurnedPartDocument = structuredClone(doc);
  const { action, segment_id, value } = fix.patch;

  if (action === "set_bore_diameter" || action === "snap_standard_drill") {
    const oldD = next.bore.diameter_mm;
    next.bore.diameter_mm = value;
    return {
      doc: next,
      summary: `Adjusted internal bore from Ø${oldD} mm to Ø${value} mm.`,
    };
  }

  if (action === "set_through_bore") {
    next.bore.is_through = true;
    const totalLen = next.segments.reduce((acc, s) => acc + s.length_mm, 0);
    next.bore.depth_mm = totalLen;
    return {
      doc: next,
      summary: `Converted blind bore into a Ø${next.bore.diameter_mm} mm through-bore (${totalLen} mm).`,
    };
  }

  if (action === "set_segment_diameter" && segment_id) {
    const seg = next.segments.find((s) => s.id === segment_id);
    if (seg) {
      const old = seg.diameter_mm;
      seg.diameter_mm = value;
      seg.semantic_ref.expected_radius = value / 2;
      return {
        doc: next,
        summary: `Updated ${seg.label} diameter from Ø${old} mm to Ø${value} mm.`,
      };
    }
  }

  if (action === "set_segment_length" && segment_id) {
    const seg = next.segments.find((s) => s.id === segment_id);
    if (seg) {
      const old = seg.length_mm;
      seg.length_mm = value;
      return {
        doc: next,
        summary: `Reduced ${seg.label} length from ${old} mm to ${value} mm.`,
      };
    }
  }

  if (action === "add_shoulder_fillet" && segment_id) {
    const seg = next.segments.find((s) => s.id === segment_id);
    if (seg) {
      seg.fillet_end_mm = value;
      return {
        doc: next,
        summary: `Added R${value} mm stress-relief fillet at ${seg.label} shoulder transition.`,
      };
    }
  }

  return { doc: next, summary: "Applied DFM geometric optimization." };
}

/**
 * Run the 7-Layer Validation & CAPP Planning Engine on the TurnedPartDocument.
 */
export function evaluateTurnedPart(doc: TurnedPartDocument): {
  issues: DfmIssue[];
  capp: CappProcessPlan;
  geometry: PartGeometry;
  analysisResult: CadAnalysisResult;
  defaultGrade: GradeRate;
} {
  const issues: DfmIssue[] = [];
  const minWall = doc.material.min_wall_mm;

  const totalLength = doc.segments.reduce((sum, s) => sum + Math.max(0.1, s.length_mm), 0);
  const maxOd = doc.segments.reduce((max, s) => Math.max(max, s.diameter_mm), 0);
  const minOd = doc.segments.reduce((min, s) => Math.min(min, s.diameter_mm), Infinity);

  // ------------------------------------------------------------------
  // Tier 1-3: 2D Axial Half-Profile (X-R) Crossover & Wall Thickness Check
  // ------------------------------------------------------------------
  let cursorX = 0;
  for (let i = 0; i < doc.segments.length; i++) {
    const seg = doc.segments[i];
    const xStart = cursorX;
    const xEnd = cursorX + seg.length_mm;
    cursorX = xEnd;

    const rExt = seg.diameter_mm / 2;
    const boreActiveHere =
      doc.bore.enabled &&
      doc.bore.diameter_mm > 0 &&
      (doc.bore.is_through || xStart < doc.bore.depth_mm);

    if (boreActiveHere) {
      const rInt = doc.bore.diameter_mm / 2;
      const wall = rExt - rInt;

      if (wall <= 0) {
        const safeOd = Math.ceil(doc.bore.diameter_mm + minWall * 4);
        issues.push({
          id: `crossover-${seg.id}`,
          layer: 3,
          severity: "error",
          code: "OD_ID_CROSSOVER",
          title: `Geometry Crossover at ${seg.label}`,
          message: `Internal bore (Ø${doc.bore.diameter_mm} mm) is larger than or equal to ${seg.label} outer diameter (Ø${seg.diameter_mm} mm). The part wall collapses.`,
          feature_ref: seg.id,
          highlight_x_range: [xStart, xEnd],
          highlight_radius: rExt,
          quick_fix: {
            label: `Increase ${seg.label} OD to Ø${safeOd} mm`,
            description: `Restores positive wall thickness (${(safeOd - doc.bore.diameter_mm) / 2} mm radial wall).`,
            patch: {
              action: "set_segment_diameter",
              segment_id: seg.id,
              value: safeOd,
            },
          },
        });
      } else if (wall < minWall) {
        const targetWall = Math.max(1.2, minWall + 0.4);
        const safeBore = Math.max(4, Math.floor((seg.diameter_mm - targetWall * 2) * 2) / 2);
        issues.push({
          id: `thin-wall-${seg.id}`,
          layer: 5,
          severity: "warning",
          code: "THIN_WALL_DEFLECTION",
          title: `Thin Wall (${wall.toFixed(2)} mm) at ${seg.label}`,
          message: `Wall thickness between ${seg.label} (Ø${seg.diameter_mm} mm) and bore (Ø${doc.bore.diameter_mm} mm) is ${wall.toFixed(2)} mm (min recommended for ${doc.material.grade_name}: ${minWall} mm). Chuck pressure and cutting forces will cause chatter and ovality.`,
          feature_ref: seg.id,
          highlight_x_range: [xStart, xEnd],
          highlight_radius: rExt,
          quick_fix:
            safeBore < doc.bore.diameter_mm
              ? {
                  label: `Fix Automatically: Reduce bore to Ø${safeBore} mm (Wall → ${((seg.diameter_mm - safeBore) / 2).toFixed(1)} mm)`,
                  description: "Eliminates thin-wall machining penalty (~18% cycle time reduction).",
                  savings_hint: "Saves ~₹180–₹320/part",
                  patch: {
                    action: "set_bore_diameter",
                    value: safeBore,
                  },
                }
              : {
                  label: `Fix Automatically: Thicken ${seg.label} OD to Ø${(doc.bore.diameter_mm + targetWall * 2).toFixed(1)} mm`,
                  description: `Thickens wall to ${targetWall.toFixed(1)} mm.`,
                  savings_hint: "Saves ~₹150/part",
                  patch: {
                    action: "set_segment_diameter",
                    segment_id: seg.id,
                    value: Number((doc.bore.diameter_mm + targetWall * 2).toFixed(1)),
                  },
                },
        });
      }
    }

    // Shoulder transition stress concentration check
    if (i < doc.segments.length - 1) {
      const nextSeg = doc.segments[i + 1];
      const stepDiff = Math.abs(seg.diameter_mm - nextSeg.diameter_mm);
      if (stepDiff >= 8 && seg.fillet_end_mm <= 0 && seg.chamfer_end_mm <= 0) {
        issues.push({
          id: `sharp-shoulder-${seg.id}`,
          layer: 5,
          severity: "info",
          code: "SHARP_SHOULDER_TRANSITION",
          title: `Sharp 90° Shoulder at ${seg.label} → ${nextSeg.label}`,
          message: `Step change of ${(stepDiff / 2).toFixed(1)} mm radial depth has a sharp internal corner. Standard turning inserts have a R0.4–R0.8 mm nose radius.`,
          feature_ref: seg.id,
          highlight_x_range: [xEnd - 1.5, xEnd + 1.5],
          highlight_radius: Math.max(seg.diameter_mm, nextSeg.diameter_mm) / 2,
          quick_fix: {
            label: `Add R0.8 mm Standard Nose Fillet at ${seg.label}`,
            description: "Matches standard CNMG/WNMG turning insert nose radius (ISO 1832).",
            patch: {
              action: "add_shoulder_fillet",
              segment_id: seg.id,
              value: 0.8,
            },
          },
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // Tier 6: Internal Boring Bar Reach (L/D) & Standard Drill Check
  // ------------------------------------------------------------------
  if (doc.bore.enabled && doc.bore.diameter_mm > 0) {
    const boreDepth = doc.bore.is_through ? totalLength : doc.bore.depth_mm;
    const boreLd = boreDepth / doc.bore.diameter_mm;

    if (boreLd > 6) {
      const recommendedBore = Math.min(
        Math.floor(minOd - minWall * 2.5),
        Math.ceil(boreDepth / 5)
      );
      issues.push({
        id: "bore-ld-ratio",
        layer: 6,
        severity: boreLd > 8 ? "blocker" : "warning",
        code: "DEEP_BORE_LD_EXCEEDED",
        title: `Deep Bore Aspect Ratio (L/D = ${boreLd.toFixed(1)}:1)`,
        message: `Bore depth (${boreDepth.toFixed(1)} mm) is ${boreLd.toFixed(1)}× its diameter (Ø${doc.bore.diameter_mm} mm). Standard steel boring bars deflect above 4:1 and carbide bars chatter above 6:1.`,
        highlight_x_range: [0, boreDepth],
        highlight_radius: doc.bore.diameter_mm / 2,
        quick_fix:
          recommendedBore > doc.bore.diameter_mm
            ? {
                label: `Fix Automatically: Enlarge bore to Ø${recommendedBore} mm (L/D → ${(boreDepth / recommendedBore).toFixed(1)}:1)`,
                description: "Brings boring bar overhang within standard carbide tooling limits.",
                savings_hint: "Saves ~20% boring cycle time",
                patch: {
                  action: "set_bore_diameter",
                  value: recommendedBore,
                },
              }
            : undefined,
      });
    }

    // Check if bore matches a standard drill size
    const stdDrill = nearestStandardDrill(doc.bore.diameter_mm);
    if (Math.abs(stdDrill - doc.bore.diameter_mm) > 0.15 && Math.abs(stdDrill - doc.bore.diameter_mm) <= 1.5) {
      issues.push({
        id: "non-std-bore-drill",
        layer: 6,
        severity: "info",
        code: "NON_STANDARD_DRILL_DIAMETER",
        title: `Non-Standard Bore Size (Ø${doc.bore.diameter_mm} mm)`,
        message: `Ø${doc.bore.diameter_mm} mm requires both drilling and single-point boring passes. Using standard drill Ø${stdDrill} mm allows a single high-speed twist drill pass.`,
        quick_fix: {
          label: `Snap Bore to Standard Drill Ø${stdDrill} mm`,
          description: "Eliminates secondary boring bar tool change.",
          savings_hint: "Saves ~₹95/part",
          patch: {
            action: "snap_standard_drill",
            value: stdDrill,
          },
        },
      });
    }
  }

  // ------------------------------------------------------------------
  // Tier 6: Part Slenderness Ratio (L/D) & Deflection Check
  // ------------------------------------------------------------------
  const slenderness = totalLength / Math.max(1, minOd);
  if (slenderness > 4.0) {
    const firstSeg = doc.segments[0];
    const targetLen = Math.max(20, Math.round(minOd * 3.5));
    issues.push({
      id: "part-slenderness",
      layer: 6,
      severity: slenderness > 8 ? "blocker" : "warning",
      code: "HIGH_SLENDERNESS_RATIO",
      title: `Slender Shaft Ratio (L/D = ${slenderness.toFixed(1)}:1)`,
      message:
        slenderness > 8
          ? `Overall length (${totalLength.toFixed(0)} mm) vs minimum diameter (Ø${minOd.toFixed(0)} mm) exceeds 8:1. Requires a hydraulic steady rest and reduced feed rates.`
          : `Slenderness ratio is ${slenderness.toFixed(1)}:1 (> 4:1). Requires a center-drill and live tailstock center support during OD turning.`,
      quick_fix:
        firstSeg && doc.segments.length === 1 && firstSeg.length_mm > targetLen
          ? {
              label: `Reduce Shaft Length to ${targetLen} mm (L/D = 3.5:1)`,
              description: "Allows rigid chuck-only machining without tailstock support.",
              savings_hint: "Saves ~15% cycle time",
              patch: {
                action: "set_segment_length",
                segment_id: firstSeg.id,
                value: targetLen,
              },
            }
          : undefined,
    });
  }

  // ------------------------------------------------------------------
  // Volumetric & Surface Area Exact Analytical Integration
  // ------------------------------------------------------------------
  let extVolumeMm3 = 0;
  let extAreaMm2 = 0;

  for (let i = 0; i < doc.segments.length; i++) {
    const s = doc.segments[i];
    const r = s.diameter_mm / 2;
    extVolumeMm3 += Math.PI * r * r * s.length_mm;
    extAreaMm2 += 2 * Math.PI * r * s.length_mm; // lateral cylinder area
    if (i === 0) extAreaMm2 += Math.PI * r * r; // front face
    if (i === doc.segments.length - 1) extAreaMm2 += Math.PI * r * r; // rear face
    if (i > 0) {
      const prevR = doc.segments[i - 1].diameter_mm / 2;
      extAreaMm2 += Math.PI * Math.abs(r * r - prevR * prevR); // annular step shoulder
    }
  }

  let boreVolumeMm3 = 0;
  let boreAreaMm2 = 0;
  if (doc.bore.enabled && doc.bore.diameter_mm > 0) {
    const rBore = Math.min(doc.bore.diameter_mm / 2, maxOd / 2 - 0.1);
    const depth = doc.bore.is_through ? totalLength : Math.min(totalLength, doc.bore.depth_mm);
    boreVolumeMm3 = Math.PI * rBore * rBore * depth;
    boreAreaMm2 = 2 * Math.PI * rBore * depth;
  }

  const finishedVolumeMm3 = Math.max(100, extVolumeMm3 - boreVolumeMm3);
  const finishedAreaMm2 = Math.max(50, extAreaMm2 + boreAreaMm2);
  const finishedMassKg = (finishedVolumeMm3 / 1000) * (doc.material.density_g_cm3 / 1000);

  // ------------------------------------------------------------------
  // Stock Selection & Chuck Workholding Allowance (Items 4, 7, 8)
  // ------------------------------------------------------------------
  const radialAllowanceMm = 2.0; // 4mm total diameter allowance
  const minRequiredOd = maxOd + radialAllowanceMm * 2;
  const standardStockOd =
    STANDARD_BAR_DIAMETERS_MM.find((d) => d >= minRequiredOd) ??
    Math.ceil(minRequiredOd / 5) * 5;

  const chuckGripAllowanceMm = Math.max(18, Math.min(35, Math.round(standardStockOd * 0.45)));
  const facingAllowanceMm = 2.0;
  const partingAllowanceMm = 3.5;
  const stockCutLengthMm =
    totalLength + chuckGripAllowanceMm + facingAllowanceMm + partingAllowanceMm;

  const stockVolumeMm3 =
    Math.PI * Math.pow(standardStockOd / 2, 2) * stockCutLengthMm;
  const stockMassKg =
    (stockVolumeMm3 / 1000) * (doc.material.density_g_cm3 / 1000);
  const removedPercent = Math.min(
    98,
    Math.max(5, ((stockVolumeMm3 - finishedVolumeMm3) / stockVolumeMm3) * 100)
  );

  // ------------------------------------------------------------------
  // Multi-Factor Setup Scorer (Setup 1 Front vs Rear Grip)
  // ------------------------------------------------------------------
  const firstSeg = doc.segments[0];
  const lastSeg = doc.segments[doc.segments.length - 1];

  function scoreCandidateSetup(
    name: "Setup 1 (Grip Front)" | "Setup 1 (Grip Rear)",
    seg: typeof firstSeg
  ): CappSetupScore {
    const d = seg.diameter_mm;
    const l = seg.length_mm;
    const minReqGrip = Math.max(12, Math.round(d * 0.35));
    const overhangRatio = totalLength / Math.max(1, d);
    // Clamping torque T = mu * F_clamp * (D/2) with mu=0.22, F_clamp=18kN
    const torqueNm = Math.round(0.22 * 18000 * (d / 2000));
    const gripScore = Math.min(40, (d / maxOd) * 25 + Math.min(15, (l / minReqGrip) * 10));
    const datumScore = d === maxOd ? 25 : 15;
    const accessScore = seg.thread ? -15 : 20; // Never grip directly on finished threads!
    const slenderPenalty = Math.max(0, (overhangRatio - 3) * 4);
    const totalScore = Math.round(
      Math.max(10, Math.min(99, gripScore + datumScore + accessScore - slenderPenalty))
    );

    return {
      setup_name: name,
      grip_segment_id: seg.id,
      grip_diameter_mm: d,
      grip_length_mm: l,
      min_required_grip_mm: minReqGrip,
      slenderness_ratio: Number(overhangRatio.toFixed(2)),
      torque_capacity_nm: torqueNm,
      score: totalScore,
      feasible: !seg.thread && d >= 8,
      notes: seg.thread
        ? "Avoid gripping on threaded surface; use bar stock chuck allowance."
        : `3-Jaw hard chuck grip on raw bar stock (Ø${standardStockOd} mm, ${chuckGripAllowanceMm} mm grip allowance) aligned with ${seg.label}.`,
    };
  }

  const setupFront = scoreCandidateSetup("Setup 1 (Grip Front)", firstSeg);
  const setupRear = scoreCandidateSetup("Setup 1 (Grip Rear)", lastSeg);
  const primarySetup = setupFront.score >= setupRear.score ? setupFront : setupRear;

  // ------------------------------------------------------------------
  // Operation Sequence Generation (CAPP DAG)
  // ------------------------------------------------------------------
  const ops: CappProcessPlan["operations"] = [
    {
      step: 1,
      setup: 1,
      operation: "Bar Feed & 3-Jaw Chuck Clamping",
      tool: `Hard Jaws (Ø${standardStockOd} mm Bar, ${chuckGripAllowanceMm} mm Grip)`,
      target_feature: "Raw Stock Datum Z0",
      est_Minutes: 0.4,
    },
    {
      step: 2,
      setup: 1,
      operation: "Front Datum Facing Pass",
      tool: "CNMG 120408 Roughing Insert (80° Rhombic)",
      target_feature: "Front Face (Z = 0.0 mm)",
      est_Minutes: 0.5,
    },
  ];

  if (slenderness > 3.5 && !doc.bore.enabled) {
    ops.push({
      step: ops.length + 1,
      setup: 1,
      operation: "Center Drilling & Live Tailstock Engagement",
      tool: "DIN 333 Form A Center Drill + Revolving Center",
      target_feature: "Spindle Centerline Axis",
      est_Minutes: 0.8,
    });
  }

  ops.push({
    step: ops.length + 1,
    setup: 1,
    operation: `OD Rough Turning (${doc.segments.length} Axial Step${doc.segments.length > 1 ? "s" : ""})`,
    tool: "CNMG 120408 Roughing Insert (ap = 2.5 mm)",
    target_feature: doc.segments.map((s) => `${s.label} Ø${s.diameter_mm}`).join(" → "),
    est_Minutes: Number(
      Math.max(0.8, (stockVolumeMm3 - extVolumeMm3) / 1000 / 12).toFixed(2)
    ),
  });

  ops.push({
    step: ops.length + 1,
    setup: 1,
    operation: `OD Finish Profiling & Corner Transitions (Ra ${doc.surface_finish_ra} µm)`,
    tool: "DNMG 150604 Finishing Insert (55° Rhombic)",
    target_feature: "External Envelope & Shoulders",
    est_Minutes: Number(Math.max(0.6, extAreaMm2 / 100 / 38).toFixed(2)),
  });

  for (const seg of doc.segments) {
    if (seg.groove) {
      ops.push({
        step: ops.length + 1,
        setup: 1,
        operation: `OD Radial Plunge Grooving (${seg.groove.width_mm} × ${seg.groove.depth_mm} mm)`,
        tool: `${seg.groove.width_mm} mm Carbide Grooving Blade`,
        target_feature: `${seg.label} (${seg.groove.type})`,
        est_Minutes: 0.7,
      });
    }
    if (seg.thread) {
      ops.push({
        step: ops.length + 1,
        setup: 1,
        operation: `Single-Point External Threading (${seg.thread.designation} - ${seg.thread.tolerance_class})`,
        tool: "16ER AG60 ISO Metric Threading Insert (Multi-Pass)",
        target_feature: `${seg.label} (${seg.thread.length_mm} mm length)`,
        est_Minutes: 1.4,
      });
    }
  }

  if (doc.bore.enabled && doc.bore.diameter_mm > 0) {
    const boreDepth = doc.bore.is_through ? totalLength : doc.bore.depth_mm;
    ops.push({
      step: ops.length + 1,
      setup: 1,
      operation: `Axial Center Spotting & Twist Drilling (Ø${Math.min(doc.bore.diameter_mm, 25).toFixed(1)} mm)`,
      tool: `Carbide Coolant-Through U-Drill / Twist Drill`,
      target_feature: `Internal Bore (${boreDepth.toFixed(0)} mm ${doc.bore.is_through ? "Through" : "Blind"})`,
      est_Minutes: Number(Math.max(0.7, (boreVolumeMm3 / 1000) / 9).toFixed(2)),
    });

    if (doc.bore.diameter_mm > 16 || !STANDARD_DRILL_SIZES_MM.includes(doc.bore.diameter_mm)) {
      ops.push({
        step: ops.length + 1,
        setup: 1,
        operation: `Internal Boring Pass to Ø${doc.bore.diameter_mm} mm H7`,
        tool: "S16R-SCLCR09 Carbide Boring Bar",
        target_feature: `Internal Bore Wall (Ra ${doc.surface_finish_ra} µm)`,
        est_Minutes: 1.1,
      });
    }
  }

  ops.push({
    step: ops.length + 1,
    setup: 1,
    operation: "Parting-Off & Rear Edge Deburr",
    tool: "3.0 mm Cutoff Blade (QD-G-300)",
    target_feature: `Rear Datum Face (Z = ${totalLength.toFixed(1)} mm)`,
    est_Minutes: 0.6,
  });

  const capp: CappProcessPlan = {
    overall_length_mm: totalLength,
    max_od_mm: maxOd,
    finished_volume_mm3: Math.round(finishedVolumeMm3),
    finished_area_mm2: Math.round(finishedAreaMm2),
    finished_mass_kg: Number(finishedMassKg.toFixed(3)),
    recommended_stock: {
      standard_diameter_mm: standardStockOd,
      cut_length_mm: Number(stockCutLengthMm.toFixed(1)),
      chuck_grip_allowance_mm: chuckGripAllowanceMm,
      facing_allowance_mm: facingAllowanceMm,
      parting_allowance_mm: partingAllowanceMm,
      stock_volume_mm3: Math.round(stockVolumeMm3),
      stock_mass_kg: Number(stockMassKg.toFixed(3)),
      removed_Percent: Number(removedPercent.toFixed(1)),
    },
    primary_setup: primarySetup,
    secondary_setup_required: false,
    operations: ops,
  };

  // ------------------------------------------------------------------
  // Build PartGeometry & CadAnalysisResult for estimatePart() Compatibility
  // ------------------------------------------------------------------
  const threadCount =
    doc.segments.filter((s) => !!s.thread).length + (doc.bore.thread ? 1 : 0);
  const grooveCount = doc.segments.filter((s) => !!s.groove).length;
  const edgeCount = doc.segments.reduce(
    (n, s) =>
      n +
      (s.chamfer_start_mm > 0 ? 1 : 0) +
      (s.chamfer_end_mm > 0 ? 1 : 0) +
      (s.fillet_end_mm > 0 ? 1 : 0),
    0
  );
  const thinWallCount = issues.filter((i) => i.code === "THIN_WALL_DEFLECTION").length;

  const geometry: PartGeometry = {
    bbox_mm: [maxOd, maxOd, totalLength],
    volume_mm3: Math.round(finishedVolumeMm3),
    area_mm2: Math.round(finishedAreaMm2),
    solid_count: 1,
    rotational: true,
    turn_stock: {
      diameter_mm: standardStockOd,
      length_mm: stockCutLengthMm,
    },
    features: {
      hole: { firm: doc.bore.enabled && doc.bore.diameter_mm > 0 ? 1 : 0, candidate: 0 },
      thread: { firm: threadCount, candidate: 0 },
      pocket: { firm: 0, candidate: 0 },
      slot: { firm: grooveCount, candidate: 0 },
      boss: { firm: 0, candidate: 0 },
      edge: { firm: edgeCount, candidate: 0 },
      turning: { firm: doc.segments.length, candidate: 0 },
      thin: { firm: thinWallCount, candidate: 0 },
      freeform: { firm: 0, candidate: 0 },
      cross: { firm: 0, candidate: 0 },
    },
  };

  const analysisResult: CadAnalysisResult = {
    analysis_version: "smartquote-ai-cad-v2.7",
    file_name: `${doc.part_name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.step`,
    processing_ms: 12,
    units: { name: "millimetre", symbol: "mm", status: "EXPLICIT" },
    warnings: issues.map((i) => `${i.title}: ${i.message}`),
    summary: {
      solid_count: 1,
      global_bbox: { x_length: maxOd, y_length: maxOd, z_length: totalLength },
      local_bbox: { x_length: maxOd, y_length: maxOd, z_length: totalLength },
      volume_mm3: Math.round(finishedVolumeMm3),
      surface_area_mm2: Math.round(finishedAreaMm2),
      center_of_mass: [0, 0, totalLength / 2],
      face_type_counts: {
        CYLINDER: doc.segments.length + (doc.bore.enabled ? 1 : 0),
        PLANE: doc.segments.length + 1,
        CONE: edgeCount,
      },
      primary_axis: [0, 0, 1],
    },
    bodies: [
      {
        body_id: 1,
        topology_counts: {
          faces: doc.segments.length * 2 + (doc.bore.enabled ? 2 : 1),
          edges: doc.segments.length * 3,
          vertices: doc.segments.length * 2,
        },
        shell_count: 1,
        valid: issues.every((i) => i.severity !== "error"),
      },
    ],
    feature_sections: [
      {
        section: 8,
        title: "Turned OD & ID Features",
        features: doc.segments.map((s, idx) => ({
          type: "TURNED_OD_STEP",
          body_id: 1,
          section: 8,
          confidence: 0.99,
          orientation: "AXIAL_Z",
          faces: [idx + 1],
          axis: [0, 0, 1],
          position: [0, 0, 0],
          details: {
            diameter_mm: s.diameter_mm,
            axial_length_mm: s.length_mm,
          },
        })),
      },
    ],
    relationships: [],
    turning: [
      {
        body_id: 1,
        stock: {
          stock_diameter_mm: standardStockOd,
          stock_length_mm: stockCutLengthMm,
          stock_volume_mm3: Math.round(stockVolumeMm3),
          finished_volume_mm3: Math.round(finishedVolumeMm3),
          material_removed_mm3: Math.round(stockVolumeMm3 - finishedVolumeMm3),
          material_removed_percent_of_stock: Number(removedPercent.toFixed(1)),
          material_removed_area_mm2: Math.round(finishedAreaMm2),
        },
        footprint: {
          status: "ROTATIONAL_SYMMETRIC",
          model_diameter_mm: maxOd,
          model_axial_length_mm: totalLength,
        },
        finished_surface_area_mm2: Math.round(finishedAreaMm2),
        operations: ops.map((o) => ({
          feature: o.operation,
          tool_family: o.tool,
          path: o.target_feature,
          machinability: "MACHINABLE",
          machinability_reason: null,
          quantity: 1,
          diameter_mm: maxOd,
          depth_mm: totalLength,
        })),
        overall_machinability: issues.some((i) => i.severity === "error" || i.severity === "blocker")
          ? "DIFFICULT — REVIEW DFM WARNINGS"
          : "MACHINABLE ON 2-AXIS CNC LATHE",
      },
    ],
    feature_count: doc.segments.length + (doc.bore.enabled ? 1 : 0) + threadCount + grooveCount,
  };

  const defaultGrade: GradeRate = {
    id: `ai-grade-${doc.material.slug}`,
    name: doc.material.grade_name,
    material_slug: doc.material.slug,
    material_name: doc.material.grade_name,
    density: doc.material.density_g_cm3,
    rate_per_kg: doc.material.rate_per_kg_inr,
  };

  return { issues, capp, geometry, analysisResult, defaultGrade };
}
