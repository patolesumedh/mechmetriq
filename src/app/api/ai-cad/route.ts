import { NextResponse } from "next/server";
import { interpretCadChatPrompt } from "@/lib/aiCad/intentParser";
import { evaluateTurnedPart, MATERIALS_CATALOG } from "@/lib/aiCad/validator";
import type { TurnedPartDocument } from "@/lib/aiCad/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      prompt?: string;
      document?: TurnedPartDocument;
    };

    const prompt = (body.prompt ?? "").trim();
    const currentDoc = body.document;

    if (!prompt || !currentDoc) {
      return NextResponse.json(
        { error: "Both prompt and current document state are required." },
        { status: 400 }
      );
    }

    // Optional LLM Structured Extraction if GEMINI_API_KEY is configured
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      try {
        const sysPrompt = `You are the MechOneHub Turning CAD Intent Parser ("AI interprets; geometry code decides").
Given the user's message and the current TurnedPartDocument JSON, return ONLY a JSON object with:
{
  "part_name": string,
  "material_slug": "steel" | "aluminium" | "stainless" | "brass",
  "quantity": number,
  "segments": [{ "label": string, "diameter_mm": number, "length_mm": number, "chamfer_start_mm": number, "chamfer_end_mm": number, "fillet_end_mm": number, "thread_designation": string | null }],
  "bore": { "enabled": boolean, "diameter_mm": number, "depth_mm": number, "is_through": boolean },
  "reply": string,
  "appliedChanges": string[]
}
Current Document: ${JSON.stringify(currentDoc)}`;

        const llmRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${sysPrompt}\n\nUser Prompt: ${prompt}` }] }],
              generationConfig: { responseMimeType: "application/json" },
            }),
            signal: AbortSignal.timeout(8000),
          }
        );

        if (llmRes.ok) {
          const data = await llmRes.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (Array.isArray(parsed.segments) && parsed.segments.length > 0) {
              const nextDoc: TurnedPartDocument = structuredClone(currentDoc);
              nextDoc.part_name = parsed.part_name || nextDoc.part_name;
              if (parsed.material_slug && MATERIALS_CATALOG[parsed.material_slug as keyof typeof MATERIALS_CATALOG]) {
                nextDoc.material = MATERIALS_CATALOG[parsed.material_slug as keyof typeof MATERIALS_CATALOG];
              }
              if (typeof parsed.quantity === "number" && parsed.quantity > 0) {
                nextDoc.quantity = parsed.quantity;
              }
              let xCursor = 0;
              nextDoc.segments = parsed.segments.map((s: Record<string, unknown>, idx: number) => {
                const d = Math.max(4, Number(s.diameter_mm) || 30);
                const l = Math.max(2, Number(s.length_mm) || 30);
                const segId = `od_seg_${idx + 1}`;
                const th = typeof s.thread_designation === "string" && s.thread_designation
                  ? {
                      designation: s.thread_designation,
                      pitch_mm: 1.5,
                      length_mm: Math.min(l, 20),
                      external: true,
                      tolerance_class: "6g",
                    }
                  : null;
                const seg = {
                  id: segId,
                  label: typeof s.label === "string" ? s.label : `Step ${idx + 1}`,
                  diameter_mm: d,
                  length_mm: l,
                  chamfer_start_mm: Number(s.chamfer_start_mm ?? 0.5),
                  chamfer_end_mm: Number(s.chamfer_end_mm ?? 0.5),
                  fillet_end_mm: Number(s.fillet_end_mm ?? 0.8),
                  thread: th,
                  groove: null,
                  semantic_ref: {
                    owner_feature: segId,
                    role: `step_${idx + 1}_od`,
                    entity_type: "FACE" as const,
                    geometry_type: "CYLINDER" as const,
                    adjacent_surface_types: ["PLANE", "CYLINDER"],
                    expected_x: Number((xCursor + l / 2).toFixed(1)),
                    expected_radius: Number((d / 2).toFixed(2)),
                  },
                };
                xCursor += l;
                return seg;
              });
              if (parsed.bore) {
                nextDoc.bore = {
                  enabled: Boolean(parsed.bore.enabled),
                  diameter_mm: Math.max(0, Number(parsed.bore.diameter_mm) || 0),
                  depth_mm: Number(parsed.bore.depth_mm) || xCursor,
                  is_through: parsed.bore.is_through !== false,
                  chamfer_entry_mm: 0.8,
                  thread: null,
                };
              }
              const evaluation = evaluateTurnedPart(nextDoc);
              return NextResponse.json({
                updatedDoc: nextDoc,
                reply: parsed.reply || "Updated the 2D profile and revolved the 3D model.",
                appliedChanges: Array.isArray(parsed.appliedChanges) ? parsed.appliedChanges : [],
                clarifications: [],
                evaluation,
                engine: "gemini-structured-schema",
              });
            }
          }
        }
      } catch {
        // Fallback cleanly to deterministic Machinist NLP Engine
      }
    }

    // Deterministic Machinist NLP Engine (zero latency, works offline/without API keys)
    const { updatedDoc, reply, appliedChanges, clarifications } = interpretCadChatPrompt(
      prompt,
      currentDoc
    );
    const evaluation = evaluateTurnedPart(updatedDoc);

    return NextResponse.json({
      updatedDoc,
      reply,
      appliedChanges,
      clarifications,
      evaluation,
      engine: "deterministic-machinist-nlp",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to process CAD chat request." },
      { status: 500 }
    );
  }
}

