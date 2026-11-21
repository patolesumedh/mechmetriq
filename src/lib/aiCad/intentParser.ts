/**
 * Structured AI Intent Parser & P0–P3 Clarification Engine.
 * Implements "AI interprets; geometry code decides" with field-level confidence.
 */

import { MATERIALS_CATALOG } from "./validator";
import type {
  ClarificationQuestion,
  FieldConfidence,
  OdSegment,
  TurnedPartDocument,
} from "./types";

const ISO_COARSE_PITCH: Record<number, number> = {
  4: 0.7,
  5: 0.8,
  6: 1.0,
  8: 1.25,
  10: 1.5,
  12: 1.75,
  14: 2.0,
  16: 2.0,
  18: 2.5,
  20: 2.5,
  22: 2.5,
  24: 3.0,
  27: 3.0,
  30: 3.5,
  33: 3.5,
  35: 2.0,
  36: 4.0,
  40: 3.0,
  42: 4.5,
  45: 4.5,
  48: 5.0,
  50: 3.0,
};

function makeSegment(
  idx: number,
  diameter_mm: number,
  length_mm: number,
  xOffset: number,
  opts?: Partial<OdSegment>
): OdSegment {
  const id = `od_seg_${idx + 1}`;
  return {
    id,
    label: opts?.label ?? `Step ${idx + 1}`,
    diameter_mm: Math.max(4, Math.min(300, Number(diameter_mm.toFixed(2)))),
    length_mm: Math.max(2, Math.min(800, Number(length_mm.toFixed(2)))),
    chamfer_start_mm: opts?.chamfer_start_mm ?? (idx === 0 ? 1.0 : 0),
    chamfer_end_mm: opts?.chamfer_end_mm ?? 0.5,
    fillet_end_mm: opts?.fillet_end_mm ?? 0.8,
    thread: opts?.thread ?? null,
    groove: opts?.groove ?? null,
    semantic_ref: {
      owner_feature: id,
      role: idx === 0 ? "primary_datum_od" : `step_${idx + 1}_shoulder_od`,
      entity_type: "FACE",
      geometry_type: "CYLINDER",
      adjacent_surface_types: ["PLANE", "CYLINDER"],
      expected_x: Number((xOffset + length_mm / 2).toFixed(1)),
      expected_radius: Number((diameter_mm / 2).toFixed(2)),
    },
  };
}

export const GOLDEN_PRESETS: Record<string, TurnedPartDocument> = {
  stepped_shaft: {
    id: "turncad-stepped-shaft",
    version: "2.7.0",
    part_name: "Stepped Drive Shaft",
    units: "mm",
    general_tolerance: "ISO 2768-m",
    surface_finish_ra: 1.6,
    material: MATERIALS_CATALOG.steel,
    quantity: 10,
    segments: [
      makeSegment(0, 55, 45, 0, { label: "Collar Flange", chamfer_start_mm: 1.5, fillet_end_mm: 1.2 }),
      makeSegment(1, 38, 40, 45, {
        label: "Bearing Journal",
        fillet_end_mm: 0.8,
        groove: { width_mm: 3.0, depth_mm: 1.5, offset_from_start_mm: 20, type: "ORING_ISO3601" },
      }),
      makeSegment(2, 24, 30, 85, {
        label: "Threaded Stub",
        chamfer_end_mm: 1.5,
        thread: {
          designation: "M24x3.0",
          pitch_mm: 3.0,
          length_mm: 24,
          external: true,
          tolerance_class: "6g",
        },
      }),
    ],
    bore: {
      enabled: true,
      diameter_mm: 14,
      depth_mm: 115,
      is_through: true,
      chamfer_entry_mm: 1.0,
      thread: null,
    },
    confidence_map: {
      overall_length_mm: { value: 115, confidence: 0.99, source: "explicit" },
      max_od_mm: { value: 55, confidence: 0.99, source: "explicit" },
      internal_bore_mm: { value: 14, confidence: 0.96, source: "explicit" },
      material_grade: { value: "EN8", confidence: 0.95, source: "explicit" },
      thread_tolerance: { value: "6g", confidence: 0.75, source: "default_library" },
    },
  },
  thin_wall_bushing: {
    id: "turncad-thin-sleeve",
    version: "2.7.0",
    part_name: "Flanged Spacer Sleeve (DFM Demo)",
    units: "mm",
    general_tolerance: "ISO 2768-m",
    surface_finish_ra: 1.6,
    material: MATERIALS_CATALOG.aluminium,
    quantity: 25,
    segments: [
      makeSegment(0, 48, 15, 0, { label: "Front Flange", chamfer_start_mm: 1.0, fillet_end_mm: 0 }),
      makeSegment(1, 30, 50, 15, { label: "Thin Barrel", chamfer_end_mm: 0.5, fillet_end_mm: 0 }),
    ],
    bore: {
      enabled: true,
      // Deliberate 0.5 mm thin wall on the Ø30 barrel (30 - 29 = 1.0 diameter -> 0.5mm radial wall!) to demonstrate Click-to-Fix DFM!
      diameter_mm: 29.0,
      depth_mm: 65,
      is_through: true,
      chamfer_entry_mm: 0.5,
      thread: null,
    },
    confidence_map: {
      overall_length_mm: { value: 65, confidence: 0.99, source: "explicit" },
      max_od_mm: { value: 48, confidence: 0.99, source: "explicit" },
      internal_bore_mm: { value: 29, confidence: 0.98, source: "explicit" },
      material_grade: { value: "Al 6061-T6", confidence: 0.95, source: "explicit" },
    },
  },
  threaded_pin: {
    id: "turncad-threaded-pin",
    version: "2.7.0",
    part_name: "Precision Shoulder Pin",
    units: "mm",
    general_tolerance: "ISO 2768-f",
    surface_finish_ra: 0.8,
    material: MATERIALS_CATALOG.stainless,
    quantity: 50,
    segments: [
      makeSegment(0, 28, 60, 0, { label: "Main Shank", chamfer_start_mm: 1.0, fillet_end_mm: 1.0 }),
      makeSegment(1, 16, 25, 60, {
        label: "M16 Threaded End",
        chamfer_end_mm: 1.2,
        thread: {
          designation: "M16x2.0",
          pitch_mm: 2.0,
          length_mm: 20,
          external: true,
          tolerance_class: "6g",
        },
      }),
    ],
    bore: {
      enabled: false,
      diameter_mm: 0,
      depth_mm: 0,
      is_through: true,
      chamfer_entry_mm: 0,
      thread: null,
    },
    confidence_map: {
      overall_length_mm: { value: 85, confidence: 0.99, source: "explicit" },
      max_od_mm: { value: 28, confidence: 0.99, source: "explicit" },
      material_grade: { value: "SS 304", confidence: 0.92, source: "explicit" },
    },
  },
};

function detectMaterial(text: string): { spec: typeof MATERIALS_CATALOG.steel; explicit: boolean } | null {
  const lower = text.toLowerCase();
  if (/\b(titanium|ti-6al-4v|ti64|grade\s*5)\b/i.test(lower)) {
    return { spec: MATERIALS_CATALOG.titanium, explicit: true };
  }
  if (/\b(peek|delrin|acetal|pom)\b/i.test(lower)) {
    return {
      spec: /\bpeek\b/i.test(lower) ? MATERIALS_CATALOG.peek : MATERIALS_CATALOG.delrin,
      explicit: true,
    };
  }
  if (/\b(6061|alumin|alu\b|al\s*6061)/i.test(lower)) {
    return { spec: MATERIALS_CATALOG.aluminium, explicit: true };
  }
  if (/\b(ss\s*304|304|316|stainless|inox)/i.test(lower)) {
    return { spec: MATERIALS_CATALOG.stainless, explicit: true };
  }
  if (/\b(brass|c360|bronze|copper)/i.test(lower)) {
    return { spec: MATERIALS_CATALOG.brass, explicit: true };
  }
  if (/\b(en8|en19|en24|steel|mild\s*steel|ms\b|carbon\s*steel|alloy\s*steel)/i.test(lower)) {
    return { spec: MATERIALS_CATALOG.steel, explicit: true };
  }
  return null;
}

/**
 * Parse natural language user prompt against the current TurnedPartDocument.
 * Supports:
 *  - Complete part creation ("Make a 100mm steel pin, 25mm diameter, M12 thread on one end")
 *  - Relative edits ("Make it 15mm shorter", "Change bore to 16mm", "Thicken wall", "Add a groove")
 *  - P0-P3 Clarification checks when critical dimensions are missing
 */
export function interpretCadChatPrompt(
  prompt: string,
  currentDoc: TurnedPartDocument
): {
  updatedDoc: TurnedPartDocument;
  reply: string;
  appliedChanges: string[];
  clarifications: ClarificationQuestion[];
} {
  const text = prompt.trim();
  const lower = text.toLowerCase();
  const next: TurnedPartDocument = structuredClone(currentDoc);
  const appliedChanges: string[] = [];
  const clarifications: ClarificationQuestion[] = [];

  // 1. Check for preset trigger keywords
  if (/\b(thin\s*wall\s*demo|dfm\s*demo|flanged\s*spacer)/i.test(lower)) {
    const preset = structuredClone(GOLDEN_PRESETS.thin_wall_bushing);
    return {
      updatedDoc: preset,
      reply:
        "Loaded the **Flanged Spacer Sleeve (DFM Demo)** in Al 6061-T6. Notice the **0.5 mm thin wall warning** on Step 2 — click the **1-Click Auto-Fix** button to repair it right in the browser!",
      appliedChanges: [
        "Loaded 2-step Al 6061-T6 bushing (Ø48×15 mm → Ø30×50 mm)",
        "Added Ø29 mm through-bore (triggers 0.5 mm thin-wall DFM alert)",
      ],
      clarifications: [],
    };
  }

  // 2. Check if user gave a vague creation prompt without dimensions (P0 Geometry Blocker)
  const hasAnyNumbers = /\d+/.test(text);
  const isVagueNewRequest =
    !hasAnyNumbers &&
    /\b(make|create|build|design|new|generate)\b/i.test(lower) &&
    !/\b(thicker|thinner|longer|shorter|remove|delete|through|groove|chamfer|fillet|brass|steel|alumin|stainless)\b/i.test(
      lower
    );

  if (isVagueNewRequest) {
    clarifications.push(
      {
        priority: "P0",
        field: "outer_diameter_and_length",
        question: "What outer diameter (OD) and overall length do you need?",
        suggestions: [
          {
            label: "Ø40 × 100 mm Stepped Shaft",
            prompt_to_append: "Make a 100mm steel shaft starting at 40mm diameter for 60mm, stepped down to 25mm for 40mm",
          },
          {
            label: "Ø50 × 60 mm Bushing with Ø20 Bore",
            prompt_to_append: "Make a 60mm long aluminum bushing, 50mm OD with a 20mm through hole",
          },
          {
            label: "Ø25 × 80 mm Pin with M16 Thread",
            prompt_to_append: "Make an 80mm stainless pin, 25mm diameter, stepped to M16 thread for 20mm",
          },
        ],
      }
    );
    return {
      updatedDoc: next,
      reply:
        "I'm ready to build your part! Because **AI interprets and geometry code decides**, I need the primary dimensions before generating the solid. Pick a template below or type the diameter and length:",
      appliedChanges: [],
      clarifications,
    };
  }

  // 3. Material detection
  const matMatch = detectMaterial(text);
  if (matMatch) {
    next.material = matMatch.spec;
    next.confidence_map.material_grade = {
      value: matMatch.spec.grade_name,
      confidence: 0.98,
      source: "explicit",
    };
    appliedChanges.push(`Material set to ${matMatch.spec.grade_name}`);
  }

  // 4. Quantity, Surface Finish (Ra), and General Tolerance detection
  const qtyMatch = text.match(/\b(?:qty|quantity|for)?\s*(\d+)\s*(?:pcs|pieces|parts|units|nos|batch)\b/i);
  if (qtyMatch) {
    const q = Math.max(1, Math.min(10000, parseInt(qtyMatch[1], 10)));
    next.quantity = q;
    appliedChanges.push(`Order quantity updated to ${q} pcs`);
  }

  const raMatch = text.match(/\bRa\s*(\d+(?:\.\d+)?)\b/i);
  if (raMatch) {
    const raVal = parseFloat(raMatch[1]);
    if (raVal <= 0.4) next.surface_finish_ra = 0.4;
    else if (raVal <= 0.8) next.surface_finish_ra = 0.8;
    else if (raVal <= 1.6) next.surface_finish_ra = 1.6;
    else next.surface_finish_ra = 3.2;
    appliedChanges.push(`Surface finish set to Ra ${next.surface_finish_ra} μm`);
  }

  if (/\b(2768-f|fine\s*tolerance|±0\.02|tight\s*tolerance)\b/i.test(lower)) {
    next.general_tolerance = "ISO 2768-f";
    appliedChanges.push("General tolerance set to ISO 2768-f (Fine)");
  } else if (/\b(2768-c|coarse\s*tolerance)\b/i.test(lower)) {
    next.general_tolerance = "ISO 2768-c";
    appliedChanges.push("General tolerance set to ISO 2768-c (Coarse)");
  }

  // 5. Check for multi-step / full part specification vs incremental edits
  const isNewPartIntent =
    /\b(make|create|design|build|start\s*with|new)\b/i.test(lower) &&
    (/\b(diam|od|ø|\d+\s*mm)\b/i.test(lower) || /\b(pin|shaft|bushing|spacer|sleeve|rod|collar|spindle)\b/i.test(lower));

  if (isNewPartIntent) {
    // Extract part name
    if (/\bspindle\b/i.test(lower)) next.part_name = "Multi-Stage CNC Spindle Shaft";
    else if (/\bgearbox\b/i.test(lower)) next.part_name = "Gearbox Output Shaft";
    else if (/\bbushing|sleeve|spacer\b/i.test(lower)) next.part_name = "Custom Turned Bushing";
    else if (/\bpin|stud\b/i.test(lower)) next.part_name = "Custom Precision Pin";
    else if (/\bflange|collar\b/i.test(lower)) next.part_name = "Turned Flanged Collar";
    else next.part_name = "Custom Stepped Shaft";

    const newSegments: OdSegment[] = [];
    let xCursor = 0;

    // Pattern 0: Explicit multi-step list, e.g. "Step 1: 72mm diameter x 35mm, Step 2: 54mm x 45mm..."
    // or multiple "Ø72 x 35mm", "72mm diameter for 35mm" pairs
    const multiStepRegex =
      /(?:step\s*\d+\s*[:=-]?\s*)?(?:ø|od\s*)?(\d+(?:\.\d+)?)\s*mm\s*(?:diameter|od)?\s*(?:[x×]|for|by|length)\s*(\d+(?:\.\d+)?)\s*mm/gi;
    const multiMatches = Array.from(text.matchAll(multiStepRegex));

    // Also check for thread spec like "M12 thread", "M35 x 2 thread for 25mm", "M24x3.0"
    const threadMatch = text.match(
      /\bM(\d+(?:\.\d+)?)(?:\s*[x×]\s*(\d+(?:\.\d+)?))?(?:\s*thread)?(?:\s*for\s*(\d+(?:\.\d+)?)\s*mm)?/i
    );

    if (multiMatches.length >= 2) {
      const stepLabels = [
        "Drive Flange",
        "Bearing Journal",
        "Seal Shoulder",
        "Threaded Stub",
        "Pilot Tail",
        "Aux Step",
      ];
      multiMatches.forEach((m, idx) => {
        const d = parseFloat(m[1]);
        const l = parseFloat(m[2]);
        newSegments.push(
          makeSegment(idx, d, l, xCursor, {
            label: stepLabels[idx] ?? `Step ${idx + 1}`,
          })
        );
        xCursor += l;
      });
      appliedChanges.push(
        `Built ${newSegments.length}-step profile: ${newSegments
          .map((s) => `Ø${s.diameter_mm}×${s.length_mm}mm`)
          .join(" → ")}`
      );
    } else {
      // Look for explicit "start at X mm ... turn/step last Y mm to Z mm"
      const totalLenMatch =
        text.match(
          /(\d+(?:\.\d+)?)\s*mm\s*(?:long|length|overall|total|pin|shaft|bushing|spacer|steel|alumin|stainless|titanium|brass)/i
        ) ?? text.match(/(?:length|long)\s*(?:of|is|=)?\s*(\d+(?:\.\d+)?)\s*mm/i);

      const startOdMatch =
        text.match(/(?:start(?:\s*at)?|main|base|od|diameter|ø)\s*(?:of|is|=)?\s*ø?(\d+(?:\.\d+)?)\s*mm/i) ??
        text.match(/ø?(\d+(?:\.\d+)?)\s*mm\s*(?:diameter|od|outer\s*diameter|wide|thick)/i);

      const stepLastLenToOd = text.match(
        /(?:turn|step|reduce)(?:\s*the)?(?:\s*last|\s*next|\s*end)?\s*(\d+(?:\.\d+)?)\s*mm\s*(?:down\s*)?to\s*ø?(\d+(?:\.\d+)?)\s*mm/i
      );
      const stepToOdForLen = text.match(
        /(?:step(?:ped)?(?:\s*down)?\s*to|then)\s*ø?(\d+(?:\.\d+)?)\s*mm\s*(?:diameter\s*)?(?:for|length|x)\s*(\d+(?:\.\d+)?)\s*mm/i
      );

      const baseOd = startOdMatch ? parseFloat(startOdMatch[1]) : 40;
      const totalLen = totalLenMatch ? parseFloat(totalLenMatch[1]) : 90;

      if (stepLastLenToOd) {
        const step2Len = parseFloat(stepLastLenToOd[1]);
        const step2Od = parseFloat(stepLastLenToOd[2]);
        const step1Len = Math.max(15, totalLen > step2Len ? totalLen - step2Len : 60);

        newSegments.push(makeSegment(0, baseOd, step1Len, 0, { label: "Main Body" }));
        xCursor += step1Len;
        newSegments.push(makeSegment(1, step2Od, step2Len, xCursor, { label: "Stepped End" }));
        xCursor += step2Len;
        appliedChanges.push(
          `Created 2-step profile: Step 1 (Ø${baseOd} × ${step1Len} mm) → Step 2 (Ø${step2Od} × ${step2Len} mm)`
        );
      } else if (stepToOdForLen) {
        const step2Od = parseFloat(stepToOdForLen[1]);
        const step2Len = parseFloat(stepToOdForLen[2]);
        const step1Len = Math.max(15, totalLen > step2Len ? totalLen - step2Len : 60);

        newSegments.push(makeSegment(0, baseOd, step1Len, 0, { label: "Primary Shaft" }));
        xCursor += step1Len;
        newSegments.push(makeSegment(1, step2Od, step2Len, xCursor, { label: "Reduced Shoulder" }));
        xCursor += step2Len;
        appliedChanges.push(
          `Created 2-step profile: Step 1 (Ø${baseOd} × ${step1Len} mm) → Step 2 (Ø${step2Od} × ${step2Len} mm)`
        );
      } else {
        if (threadMatch) {
          const mDia = parseFloat(threadMatch[1]);
          const mPitch = threadMatch[2]
            ? parseFloat(threadMatch[2])
            : ISO_COARSE_PITCH[Math.round(mDia)] ?? 1.5;
          const mLen = threadMatch[3] ? parseFloat(threadMatch[3]) : Math.min(25, Math.round(mDia * 1.5));

          if (mDia < baseOd) {
            const bodyLen = Math.max(15, totalLen > mLen ? totalLen - mLen : totalLen);
            newSegments.push(makeSegment(0, baseOd, bodyLen, 0, { label: "Main Shank" }));
            xCursor += bodyLen;
            newSegments.push(
              makeSegment(1, mDia, mLen, xCursor, {
                label: `M${mDia} Threaded End`,
                thread: {
                  designation: `M${mDia}x${mPitch}`,
                  pitch_mm: mPitch,
                  length_mm: mLen,
                  external: true,
                  tolerance_class: "6g",
                },
              })
            );
            xCursor += mLen;
            appliedChanges.push(
              `Built Ø${baseOd} × ${bodyLen} mm shank with stepped M${mDia}×${mPitch} threaded stub (${mLen} mm)`
            );
          } else {
            newSegments.push(
              makeSegment(0, baseOd, totalLen, 0, {
                label: "Main Cylinder",
                thread: {
                  designation: `M${mDia}x${mPitch}`,
                  pitch_mm: mPitch,
                  length_mm: mLen,
                  external: true,
                  tolerance_class: "6g",
                },
              })
            );
            appliedChanges.push(`Built Ø${baseOd} × ${totalLen} mm cylinder with M${mDia}×${mPitch} thread`);
          }
        } else {
          newSegments.push(makeSegment(0, baseOd, totalLen, 0, { label: "Main Body" }));
          appliedChanges.push(`Built cylindrical profile: Ø${baseOd} mm OD × ${totalLen} mm length`);
        }
      }
    }

    // Attach thread to matching diameter segment or last segment if threadMatch existed
    if (threadMatch && !newSegments.some((s) => !!s.thread)) {
      const mDia = parseFloat(threadMatch[1]);
      const mPitch = threadMatch[2]
        ? parseFloat(threadMatch[2])
        : ISO_COARSE_PITCH[Math.round(mDia)] ?? 1.5;
      const targetSeg =
        newSegments.find((s) => Math.abs(s.diameter_mm - mDia) <= 1.5) ??
        newSegments[newSegments.length - 1];
      const mLen = threadMatch[3]
        ? parseFloat(threadMatch[3])
        : Math.min(targetSeg.length_mm, Math.round(mDia * 1.2));
      targetSeg.diameter_mm = mDia;
      targetSeg.thread = {
        designation: `M${mDia}x${mPitch}`,
        pitch_mm: mPitch,
        length_mm: mLen,
        external: true,
        tolerance_class: "6g",
      };
      appliedChanges.push(`Added external thread M${mDia}×${mPitch} (${mLen} mm) on ${targetSeg.label}`);
    }

    // Attach groove if mentioned in creation prompt
    if (/\b(groove|undercut|o-ring|oring|relief)\b/i.test(lower)) {
      const stepGrooveMatch = text.match(/groove\s*on\s*step\s*(\d+)/i);
      const gIdx = stepGrooveMatch
        ? Math.max(0, Math.min(newSegments.length - 1, parseInt(stepGrooveMatch[1], 10) - 1))
        : Math.min(1, newSegments.length - 1);
      const targetSeg = newSegments[gIdx];
      const widthMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:wide\s*)?(?:o-?ring\s*)?groove/i);
      const w = widthMatch ? parseFloat(widthMatch[1]) : 3.5;
      targetSeg.groove = {
        width_mm: w,
        depth_mm: 1.8,
        offset_from_start_mm: Math.round(targetSeg.length_mm / 2),
        type: /\bo-?ring\b/i.test(lower) ? "ORING_ISO3601" : "OD_GROOVE",
      };
      appliedChanges.push(`Added ${w} × 1.8 mm radial groove on ${targetSeg.label}`);
    }

    // Chamfer & fillet in creation prompt
    const chamferMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*chamfer/i);
    if (chamferMatch) {
      const c = parseFloat(chamferMatch[1]);
      newSegments[0].chamfer_start_mm = c;
      newSegments[newSegments.length - 1].chamfer_end_mm = c;
      appliedChanges.push(`Added ${c} mm × 45° entry/exit chamfers`);
    }
    const filletMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*fillet/i);
    if (filletMatch) {
      const f = parseFloat(filletMatch[1]);
      for (const s of newSegments) s.fillet_end_mm = f;
      appliedChanges.push(`Set shoulder transition fillets to R${f} mm`);
    }

    next.segments = newSegments;

    // Check if bore / hole was mentioned in the creation prompt
    const boreMatch =
      text.match(/(?:drill|bore|hole|id|inner\s*diameter)(?:\s*of|\s*is|\s*a)?\s*ø?(\d+(?:\.\d+)?)\s*mm/i) ??
      text.match(/ø?(\d+(?:\.\d+)?)\s*mm\s*(?:through[\s-]*hole|bore|blind\s*hole|center\s*hole|id)/i);

    if (boreMatch) {
      const bDia = parseFloat(boreMatch[1]);
      const isBlind = /\bblind\b/i.test(lower);
      const blindDepthMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*deep/i);
      const totalL = next.segments.reduce((s, seg) => s + seg.length_mm, 0);
      next.bore = {
        enabled: true,
        diameter_mm: bDia,
        depth_mm: isBlind && blindDepthMatch ? parseFloat(blindDepthMatch[1]) : totalL,
        is_through: !isBlind,
        chamfer_entry_mm: 0.8,
        thread: null,
      };
      appliedChanges.push(
        `Added Ø${bDia} mm ${next.bore.is_through ? "through-hole" : `blind bore (${next.bore.depth_mm} mm deep)`}`
      );
    } else if (/\b(no\s*hole|solid|no\s*bore|pin)\b/i.test(lower)) {
      next.bore.enabled = false;
      next.bore.diameter_mm = 0;
    }
  } else {
    // ------------------------------------------------------------------
    // Incremental Live Chat Edits on Existing Part
    // ------------------------------------------------------------------

    // A) Relative length changes ("10mm shorter", "20mm longer", "length to 80mm")
    const shorterMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*shorter/i);
    const longerMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*longer/i);
    const setLenMatch = text.match(/(?:length|long)\s*(?:to|is|=)\s*(\d+(?:\.\d+)?)\s*mm/i);

    if (shorterMatch) {
      const delta = parseFloat(shorterMatch[1]);
      const target = next.segments[0];
      const oldL = target.length_mm;
      target.length_mm = Math.max(5, Number((oldL - delta).toFixed(1)));
      appliedChanges.push(`Shortened ${target.label} from ${oldL} mm to ${target.length_mm} mm (-${delta} mm)`);
    } else if (longerMatch) {
      const delta = parseFloat(longerMatch[1]);
      const target = next.segments[0];
      const oldL = target.length_mm;
      target.length_mm = Number((oldL + delta).toFixed(1));
      appliedChanges.push(`Lengthened ${target.label} from ${oldL} mm to ${target.length_mm} mm (+${delta} mm)`);
    } else if (setLenMatch) {
      const newTotal = parseFloat(setLenMatch[1]);
      const currentTotal = next.segments.reduce((s, seg) => s + seg.length_mm, 0);
      if (currentTotal > 0) {
        const scale = newTotal / currentTotal;
        for (const seg of next.segments) {
          seg.length_mm = Math.max(4, Number((seg.length_mm * scale).toFixed(1)));
        }
        appliedChanges.push(`Scaled overall part length to ${newTotal} mm`);
      }
    }

    // B) Bore / Hole edits ("change bore to 20mm", "remove bore", "drill 12mm through hole")
    if (/\b(remove|delete|no|close)\s*(?:the\s*)?(?:bore|hole|id)\b/i.test(lower)) {
      next.bore.enabled = false;
      next.bore.diameter_mm = 0;
      appliedChanges.push("Removed internal axial bore (solid cross-section)");
    } else {
      const boreEditMatch =
        text.match(/(?:bore|hole|id|drill)(?:\s*to|\s*of|\s*is|\s*=)?\s*ø?(\d+(?:\.\d+)?)\s*mm/i) ??
        text.match(/ø?(\d+(?:\.\d+)?)\s*mm\s*(?:bore|through\s*hole|hole|drill)/i);
      if (boreEditMatch) {
        const bDia = parseFloat(boreEditMatch[1]);
        const totalL = next.segments.reduce((s, seg) => s + seg.length_mm, 0);
        next.bore.enabled = true;
        next.bore.diameter_mm = bDia;
        next.bore.is_through = !/\bblind\b/i.test(lower);
        next.bore.depth_mm = totalL;
        appliedChanges.push(`Updated internal bore to Ø${bDia} mm`);
      }
    }

    // C) Outer Diameter (OD) edits ("change OD to 50mm", "step 2 diameter to 30mm", "thicken wall to 2mm")
    const thickenWallMatch = text.match(/thicken\s*wall\s*(?:to|by)?\s*(\d+(?:\.\d+)?)?\s*mm?/i);
    if (thickenWallMatch && next.bore.enabled) {
      const targetWall = thickenWallMatch[1] ? parseFloat(thickenWallMatch[1]) : 1.5;
      for (const seg of next.segments) {
        const currentWall = (seg.diameter_mm - next.bore.diameter_mm) / 2;
        if (currentWall < targetWall) {
          seg.diameter_mm = Number((next.bore.diameter_mm + targetWall * 2).toFixed(1));
          appliedChanges.push(`Thickened ${seg.label} to Ø${seg.diameter_mm} mm (${targetWall} mm radial wall)`);
        }
      }
    }

    const stepOdMatch = text.match(/step\s*(\d+)\s*(?:diameter|od)?\s*(?:to|=)\s*ø?(\d+(?:\.\d+)?)\s*mm/i);
    if (stepOdMatch) {
      const stepIdx = parseInt(stepOdMatch[1], 10) - 1;
      const newOd = parseFloat(stepOdMatch[2]);
      if (next.segments[stepIdx]) {
        next.segments[stepIdx].diameter_mm = newOd;
        appliedChanges.push(`Updated Step ${stepIdx + 1} outer diameter to Ø${newOd} mm`);
      }
    } else if (!boreEditMatchFromText(text)) {
      const odEditMatch = text.match(/(?:od|outer\s*diameter|diameter)\s*(?:to|is|=)\s*ø?(\d+(?:\.\d+)?)\s*mm/i);
      if (odEditMatch) {
        const newOd = parseFloat(odEditMatch[1]);
        next.segments[0].diameter_mm = newOd;
        appliedChanges.push(`Updated ${next.segments[0].label} outer diameter to Ø${newOd} mm`);
      }
    }

    // D) Add a new step ("add a step of 22mm diameter and 30mm length")
    const addStepMatch = text.match(
      /add\s*(?:a\s*)?(?:step|shoulder|cylinder)\s*(?:of|with|at)?\s*ø?(\d+(?:\.\d+)?)\s*mm\s*(?:diameter|od)?\s*(?:and|by|x|for)?\s*(\d+(?:\.\d+)?)\s*mm/i
    );
    if (addStepMatch) {
      const d = parseFloat(addStepMatch[1]);
      const l = parseFloat(addStepMatch[2]);
      const xOff = next.segments.reduce((s, seg) => s + seg.length_mm, 0);
      next.segments.push(makeSegment(next.segments.length, d, l, xOff));
      appliedChanges.push(`Appended Step ${next.segments.length} (Ø${d} × ${l} mm)`);
    }

    // E) Thread edits ("add M16 thread", "remove thread")
    if (/\b(remove|delete|no)\s*thread/i.test(lower)) {
      for (const s of next.segments) s.thread = null;
      appliedChanges.push("Removed external thread feature");
    } else {
      const threadEdit = text.match(/\bM(\d+(?:\.\d+)?)(?:\s*[x×]\s*(\d+(?:\.\d+)?))?/i);
      if (threadEdit) {
        const mDia = parseFloat(threadEdit[1]);
        const mPitch = threadEdit[2]
          ? parseFloat(threadEdit[2])
          : ISO_COARSE_PITCH[Math.round(mDia)] ?? 1.5;
        const lastSeg = next.segments[next.segments.length - 1];
        lastSeg.diameter_mm = mDia;
        lastSeg.thread = {
          designation: `M${mDia}x${mPitch}`,
          pitch_mm: mPitch,
          length_mm: Math.min(lastSeg.length_mm, Math.round(mDia * 1.4)),
          external: true,
          tolerance_class: "6g",
        };
        appliedChanges.push(
          `Applied ${lastSeg.thread.designation} thread (${lastSeg.thread.length_mm} mm) to ${lastSeg.label}`
        );
      }
    }

    // F) Groove / Undercut edits ("add a 3mm groove", "add O-ring groove")
    if (/\b(groove|undercut|o-ring|oring|relief)\b/i.test(lower)) {
      const targetSeg = next.segments[Math.min(1, next.segments.length - 1)];
      const widthMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*(?:wide\s*)?groove/i);
      const w = widthMatch ? parseFloat(widthMatch[1]) : 3.0;
      targetSeg.groove = {
        width_mm: w,
        depth_mm: 1.5,
        offset_from_start_mm: Math.round(targetSeg.length_mm / 2),
        type: /\bo-?ring\b/i.test(lower) ? "ORING_ISO3601" : "OD_GROOVE",
      };
      appliedChanges.push(`Added ${w} × 1.5 mm radial groove on ${targetSeg.label}`);
    }

    // G) Chamfer / Fillet edits ("add 1.5mm chamfer", "add 2mm fillet")
    const chamferMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*chamfer/i);
    if (chamferMatch) {
      const c = parseFloat(chamferMatch[1]);
      next.segments[0].chamfer_start_mm = c;
      next.segments[next.segments.length - 1].chamfer_end_mm = c;
      appliedChanges.push(`Updated entry/exit chamfers to ${c} mm × 45°`);
    }

    const filletMatch = text.match(/(\d+(?:\.\d+)?)\s*mm\s*fillet/i);
    if (filletMatch) {
      const f = parseFloat(filletMatch[1]);
      for (const s of next.segments) s.fillet_end_mm = f;
      appliedChanges.push(`Updated shoulder transition fillets to R${f} mm`);
    }
  }

  // Re-sync bore depth if through-hole
  const finalTotalLength = next.segments.reduce((s, seg) => s + seg.length_mm, 0);
  if (next.bore.enabled && next.bore.is_through) {
    next.bore.depth_mm = finalTotalLength;
  }

  // Update semantic reference descriptors & confidence map
  let xAcc = 0;
  for (let i = 0; i < next.segments.length; i++) {
    const s = next.segments[i];
    s.semantic_ref.expected_x = Number((xAcc + s.length_mm / 2).toFixed(1));
    s.semantic_ref.expected_radius = Number((s.diameter_mm / 2).toFixed(2));
    xAcc += s.length_mm;
  }

  const maxOdNow = next.segments.reduce((m, s) => Math.max(m, s.diameter_mm), 0);
  const confMap: Record<string, FieldConfidence> = {
    overall_length_mm: { value: finalTotalLength, confidence: 0.99, source: "explicit" },
    max_od_mm: { value: maxOdNow, confidence: 0.99, source: "explicit" },
    material_grade: next.confidence_map.material_grade ?? {
      value: next.material.grade_name,
      confidence: 0.9,
      source: "inferred",
    },
    general_tolerance: { value: next.general_tolerance, confidence: 0.85, source: "default_library" },
  };
  if (next.bore.enabled) {
    confMap.internal_bore_mm = { value: next.bore.diameter_mm, confidence: 0.96, source: "explicit" };
  }
  next.confidence_map = confMap;

  if (appliedChanges.length === 0) {
    return {
      updatedDoc: next,
      reply:
        "I kept your current geometry intact. You can ask me to:\n• **Create a new part:** *\"Make a 120mm steel shaft, start at 60mm diameter, step the last 40mm to 35mm, add M35x2 thread and a 16mm through-hole\"*\n• **Modify dimensions:** *\"Make it 15mm shorter\"*, *\"Change bore to 20mm\"*, *\"Add a 3mm groove\"*, or *\"Switch material to Aluminum 6061\"*",
      appliedChanges: [],
      clarifications: [],
    };
  }

  const summaryLine = appliedChanges.map((c) => `• ${c}`).join("\n");
  return {
    updatedDoc: next,
    reply: `Updated the **2D axial profile ($X-R$)** and revolved the **3D B-Rep model** (${finalTotalLength} mm total length, Ø${maxOdNow} mm max OD):\n${summaryLine}`,
    appliedChanges,
    clarifications,
  };
}

function boreEditMatchFromText(text: string): boolean {
  return /\b(bore|hole|id|drill)\b/i.test(text);
}

