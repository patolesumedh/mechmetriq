"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  formatInr,
  type GradeRate,
  type PricingSettings,
} from "@/lib/smartQuote/pricingFormat";
import { GOLDEN_PRESETS } from "@/lib/aiCad/intentParser";
import {
  applyDfmQuickFix,
  DEFAULT_PRICING_SETTINGS,
  evaluateTurnedPart,
  MATERIALS_CATALOG,
} from "@/lib/aiCad/validator";
import {
  generateCadQueryPythonScript,
  generateStepFileContent,
} from "@/lib/aiCad/stepExporter";
import {
  parseUploadedCadFile,
  type ParsedCadModel3D,
} from "@/lib/aiCad/cadFileParser";
import type {
  ChatTurn,
  DfmQuickFix,
  MaterialSlug,
  TurnedPartDocument,
} from "@/lib/aiCad/types";
import { Cad3DCanvas } from "./Cad3DCanvas";

const QUICK_PROMPTS = [
  "Make a 120mm steel shaft, start at 60mm diameter, step the last 40mm to 35mm, add M35x2 thread and a 16mm through hole",
  "Load thin wall DFM demo",
  "Make it 15mm shorter",
  "Change bore to 20mm",
  "Add a 3mm O-ring groove",
  "Switch material to Aluminum 6061",
];

interface HistorySnapshot {
  doc: TurnedPartDocument;
  parsedModel: ParsedCadModel3D | null;
  label: string;
}

export function AiCadStudio({
  grades,
  settings,
  initialDoc,
  initialParsedModel,
  onAddStepFileToQuote,
}: {
  grades?: GradeRate[];
  settings?: PricingSettings | null;
  initialDoc?: TurnedPartDocument | null;
  initialParsedModel?: ParsedCadModel3D | null;
  onAddStepFileToQuote?: (file: File, doc: TurnedPartDocument) => void;
}) {
  const defaultDoc = useMemo(
    () =>
      initialDoc
        ? structuredClone(initialDoc)
        : structuredClone(GOLDEN_PRESETS.stepped_shaft),
    [initialDoc]
  );

  const [doc, setDoc] = useState<TurnedPartDocument>(() => structuredClone(defaultDoc));
  const [parsedModel, setParsedModel] = useState<ParsedCadModel3D | null>(
    initialParsedModel ?? null
  );
  const [activePreset, setActivePreset] = useState<
    "stepped_shaft" | "thin_wall_bushing" | "threaded_pin" | null
  >(initialDoc || initialParsedModel ? null : "stepped_shaft");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    initialParsedModel?.fileName ?? null
  );

  // Undo / Redo history stack
  const [history, setHistory] = useState<HistorySnapshot[]>(() => [
    {
      doc: structuredClone(defaultDoc),
      parsedModel: initialParsedModel ?? null,
      label: initialParsedModel?.fileName
        ? `Uploaded ${initialParsedModel.fileName}`
        : "Initial Stepped Shaft",
    },
  ]);
  const [historyIdx, setHistoryIdx] = useState<number>(0);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [promptInput, setPromptInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<
    "sliders" | "dfm" | "capp" | "schema"
  >("sliders");
  const [selectedTier, setSelectedTier] = useState<string>("standard");

  const [messages, setMessages] = useState<ChatTurn[]>(() => [
    {
      id: "welcome-1",
      role: "assistant",
      content:
        "Welcome to **MECHmetrIQ AI-CAD Live Studio**.\nDescribe the part you need in plain English, click a prompt below to pre-fill the input box, or upload a `.STEP` / `.STL` file. You can **Revert** to any earlier message in the chat (which removes messages ahead of it).",
      timestamp: "Just now",
      applied_changes: [
        "Loaded preset: Stepped Drive Shaft (EN8 Steel, 3 steps, M24×3.0 thread, Ø14 mm through-bore)",
      ],
      snapshot_doc: structuredClone(defaultDoc),
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialDoc) {
      const cloned = structuredClone(initialDoc);
      setDoc(cloned);
      setParsedModel(initialParsedModel ?? null);
      setActivePreset(null);
      setUploadedFileName(initialParsedModel?.fileName ?? null);
      setHistory([
        {
          doc: structuredClone(cloned),
          parsedModel: initialParsedModel ?? null,
          label: `Loaded ${cloned.part_name}`,
        },
      ]);
      setHistoryIdx(0);
      setMessages([
        {
          id: `init-${Date.now()}`,
          role: "assistant",
          content: initialParsedModel?.fileName
            ? `📂 **Fresh CAD Session Started:** \`${initialParsedModel.fileName}\`\nLoaded **${cloned.part_name}** (${cloned.segments.length} steps, ${cloned.material.grade_name}).`
            : `Loaded **${cloned.part_name}** into a fresh AI-CAD session.`,
          timestamp: "Just now",
          applied_changes: initialParsedModel?.summaryNotes ?? [
            `Loaded ${cloned.part_name}`,
          ],
          snapshot_doc: structuredClone(cloned),
        },
      ]);
    }
  }, [initialDoc, initialParsedModel]);

  function commitDocState(
    nextDoc: TurnedPartDocument,
    nextModel: ParsedCadModel3D | null,
    label: string
  ) {
    const cloned = structuredClone(nextDoc);
    setDoc(cloned);
    setParsedModel(nextModel);
    setHistory((prev) => {
      const sliced = prev.slice(0, historyIdx + 1);
      return [...sliced, { doc: structuredClone(cloned), parsedModel: nextModel, label }];
    });
    setHistoryIdx((idx) => idx + 1);
  }

  function handleUndo() {
    if (historyIdx <= 0) return;
    const prevIdx = historyIdx - 1;
    const snap = history[prevIdx];
    if (!snap) return;
    setHistoryIdx(prevIdx);
    setDoc(structuredClone(snap.doc));
    setParsedModel(snap.parsedModel);
  }

  function handleRedo() {
    if (historyIdx >= history.length - 1) return;
    const nextIdx = historyIdx + 1;
    const snap = history[nextIdx];
    if (!snap) return;
    setHistoryIdx(nextIdx);
    setDoc(structuredClone(snap.doc));
    setParsedModel(snap.parsedModel);
  }

  const [revertingTarget, setRevertingTarget] = useState<{
    turn: ChatTurn;
    idx: number;
    partName: string;
    subsequentCount: number;
  } | null>(null);

  /**
   * Revert to a specific chat message at `msgIdx`:
   * - Restores the 3D CAD document snapshot from that message
   * - Deletes all chat messages ahead of `msgIdx`
   * - Synchronizes the Undo/Redo history stack so `msgIdx` becomes the current active head
   */
  function handleRevertToMessage(turn: ChatTurn, msgIdx: number) {
    if (!turn.snapshot_doc) return;
    const subsequentCount = messages.length - 1 - msgIdx;
    setRevertingTarget({
      turn,
      idx: msgIdx,
      partName: turn.snapshot_doc.part_name,
      subsequentCount,
    });
  }

  function confirmRevert() {
    if (!revertingTarget) return;
    const { turn, idx: msgIdx } = revertingTarget;
    if (!turn.snapshot_doc) return;
    const restored: TurnedPartDocument = structuredClone(turn.snapshot_doc);
    const keepMessages = messages.slice(0, msgIdx + 1);

    // Rebuild history stack strictly from the remaining assistant snapshots up to msgIdx
    const rebuiltHistory: HistorySnapshot[] = keepMessages
      .filter((m) => m.role === "assistant" && !!m.snapshot_doc)
      .map((m, idx) => ({
        doc: structuredClone(m.snapshot_doc!),
        parsedModel: idx === 0 ? parsedModel : null,
        label: `Step ${idx + 1}: ${m.snapshot_doc!.part_name}`,
      }));

    const fallbackHist: HistorySnapshot[] = [
      { doc: structuredClone(restored), parsedModel: null, label: restored.part_name },
    ];
    const nextHist: HistorySnapshot[] =
      rebuiltHistory.length > 0 ? rebuiltHistory : fallbackHist;

    setDoc(restored);
    if (msgIdx > 0) {
      setParsedModel(null);
    }
    setMessages(keepMessages);
    setHistory(nextHist);
    setHistoryIdx(nextHist.length - 1);
    setRevertingTarget(null);
  }

  function cancelRevert() {
    setRevertingTarget(null);
  }

  function handleSelectPreset(
    presetKey: "stepped_shaft" | "thin_wall_bushing" | "threaded_pin"
  ) {
    const preset = structuredClone(GOLDEN_PRESETS[presetKey]);
    setActivePreset(presetKey);
    setUploadedFileName(null);
    setParsedModel(null);
    setDoc(preset);
    setPromptInput("");
    setActiveBottomTab(presetKey === "thin_wall_bushing" ? "dfm" : "sliders");
    setHistory([
      {
        doc: structuredClone(preset),
        parsedModel: null,
        label: `Preset: ${preset.part_name}`,
      },
    ]);
    setHistoryIdx(0);
    setMessages([
      {
        id: `preset-${presetKey}-${Date.now()}`,
        role: "assistant",
        content: `✨ **Fresh Session Started — Loaded Preset:** **${preset.part_name}** (${preset.material.grade_name}, ${preset.segments.length} axial steps).\nType in chat or use the sliders to modify this part.`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        applied_changes: [
          `Fresh session: ${preset.part_name} (${preset.segments.map((s) => `Ø${s.diameter_mm}×${s.length_mm}mm`).join(" → ")})`,
        ],
        snapshot_doc: structuredClone(preset),
      },
    ]);
  }

  function handleResetSession() {
    handleSelectPreset(activePreset ?? "stepped_shaft");
  }

  /**
   * Populate the chat input field without auto-submitting so the user can review/edit first.
   */
  function populatePromptWithoutSending(text: string) {
    setPromptInput(text);
    setTimeout(() => {
      promptInputRef.current?.focus();
      promptInputRef.current?.setSelectionRange(text.length, text.length);
    }, 10);
  }

  /**
   * Upload a new CAD file (.STEP / .STL / .turncad):
   * - Starts a completely fresh session (wipes old chat messages and history)
   * - Removes any active preset part (`activePreset = null`)
   */
  async function handleCadFileUpload(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;
    try {
      const model = await parseUploadedCadFile(file);
      const freshDoc = structuredClone(model.turnedDoc);

      // Remove preset state & start a completely fresh session for the uploaded file
      setActivePreset(null);
      setUploadedFileName(file.name);
      setPromptInput("");
      setDoc(freshDoc);
      setParsedModel(model);
      setActiveBottomTab("sliders");
      setHistory([
        {
          doc: structuredClone(freshDoc),
          parsedModel: model,
          label: `Uploaded ${file.name}`,
        },
      ]);
      setHistoryIdx(0);
      setMessages([
        {
          id: `up-${Date.now()}`,
          role: "assistant",
          content: `📂 **Fresh Session — Uploaded CAD Model Loaded:** \`${file.name}\`\nRemoved previous preset part. You are now viewing **${freshDoc.part_name}** (${freshDoc.segments.length} steps, ${freshDoc.material.grade_name}).\nUse the 3D filters (**Feature Map**, **Wall Thickness**, **Cut in Half**) or type in chat to modify it!`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          applied_changes: model.summaryNotes,
          snapshot_doc: structuredClone(freshDoc),
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `uperr-${Date.now()}`,
          role: "assistant",
          content: `Could not parse "${file.name}": ${
            e instanceof Error ? e.message : "unknown error"
          }`,
          timestamp: "Now",
        },
      ]);
    }
  }

  // Run 7-layer validation & CAPP evaluation on current document
  const evaluation = useMemo(() => evaluateTurnedPart(doc), [doc]);
  const { issues, capp, defaultGrade } = evaluation;

  // Match material against DB grade rates if available, otherwise fallback to catalog grade
  const activeGrade: GradeRate = useMemo(() => {
    if (grades && grades.length > 0) {
      const found =
        grades.find((g) => g.material_slug === doc.material.slug) ?? grades[0];
      if (found) return found;
    }
    return defaultGrade;
  }, [grades, doc.material.slug, defaultGrade]);

  const activeSettings = settings ?? DEFAULT_PRICING_SETTINGS;

  // Live interactive turning studio estimate (client-safe preview)
  const priceEstimate = useMemo(() => {
    const qty = Math.max(1, doc.quantity);
    const threadCount = doc.segments.filter((s) => !!s.thread).length;
    const matCost =
      capp.recommended_stock.stock_mass_kg *
      activeGrade.rate_per_kg *
      (1 + activeSettings.scrap_pct / 100);
    const totalOpMin = capp.operations.reduce((acc, op) => acc + op.est_Minutes, 0);
    const cycleMin = Math.max(1.5, totalOpMin);
    const tolFactor =
      activeSettings.tolerance_multiplier[doc.general_tolerance] ?? 1.0;
    const raFactor =
      activeSettings.roughness_multiplier[String(doc.surface_finish_ra)] ?? 1.0;
    const machCost =
      (cycleMin * tolFactor * raFactor +
        threadCount * activeSettings.thread_min_each +
        activeSettings.handling_min_per_part) *
      (activeSettings.turning_rate_per_hr / 60);
    const setupsCount = capp.secondary_setup_required ? 2 : 1;
    const setupMin =
      setupsCount * activeSettings.setup_min_per_setup +
      activeSettings.programming_min;
    const setupPerPart =
      (setupMin * (activeSettings.turning_rate_per_hr / 60)) / qty;
    const baseUnit = Math.max(
      45,
      (matCost + machCost + setupPerPart) * (1 + activeSettings.margin_pct / 100)
    );

    const tiers = activeSettings.tiers.map((t) => {
      const unit_price = Math.round(baseUnit * t.multiplier);
      const total = Math.max(
        activeSettings.min_order_value,
        Math.round(unit_price * qty)
      );
      return {
        key: t.key,
        label: t.label,
        lead_days: t.days,
        unit_price,
        total,
      };
    });
    const tierObj =
      tiers.find((t) => t.key === selectedTier) ?? tiers[1] ?? tiers[0];
    return { est: { tiers }, tierObj };
  }, [capp, activeGrade, activeSettings, doc, selectedTier]);

  async function sendChatMessage(rawPrompt?: string) {
    const text = (rawPrompt ?? promptInput).trim();
    if (!text || sending) return;
    if (!rawPrompt) setPromptInput("");

    const userMsg: ChatTurn = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await fetch("/api/ai-cad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, document: doc }),
      });
      const data = await res.json();
      if (data.updatedDoc) {
        commitDocState(data.updatedDoc, null, text.slice(0, 32));
        const errs = (data.evaluation?.issues ?? []).filter(
          (i: { severity: string }) =>
            i.severity === "error" || i.severity === "blocker"
        ).length;
        const warns = (data.evaluation?.issues ?? []).filter(
          (i: { severity: string }) => i.severity === "warning"
        ).length;

        const botMsg: ChatTurn = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          applied_changes: data.appliedChanges,
          clarifications: data.clarifications,
          dfm_count: { errors: errs, warnings: warns },
          snapshot_doc: structuredClone(data.updatedDoc),
        };
        setMessages((prev) => [...prev, botMsg]);
        if (errs > 0 || warns > 0) {
          setActiveBottomTab("dfm");
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Could not reach the CAD compiler. Please try again.",
          timestamp: "Now",
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(
        () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        50
      );
    }
  }

  function handleApplyQuickFix(fix: DfmQuickFix) {
    const { doc: repaired, summary } = applyDfmQuickFix(doc, fix);
    commitDocState(repaired, parsedModel, fix.label);
    setMessages((prev) => [
      ...prev,
      {
        id: `fix-${Date.now()}`,
        role: "assistant",
        content: `✅ **1-Click DFM Auto-Fix Applied:** ${summary}`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        applied_changes: [summary],
        snapshot_doc: structuredClone(repaired),
      },
    ]);
  }

  function downloadFile(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportStep() {
    const content = generateStepFileContent(doc);
    const safeName = `${doc.part_name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.step`;
    downloadFile(content, safeName, "application/step");
  }

  function handleAddToQuoteCart() {
    if (!onAddStepFileToQuote) return;
    const content = generateStepFileContent(doc);
    const safeName = `${doc.part_name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.step`;
    const file = new File([content], safeName, { type: "application/step" });
    onAddStepFileToQuote(file, doc);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Compact Top Workstation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-grid bg-surface px-3.5 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {uploadedFileName ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400 bg-emerald-50 px-3 py-1 text-[11.5px] font-bold text-emerald-900">
                📂 Uploaded CAD Session: <code className="font-mono">{uploadedFileName}</code>
              </span>
              <button
                type="button"
                onClick={() => handleSelectPreset("stepped_shaft")}
                className="rounded-lg border border-grid bg-plane px-2.5 py-1 text-[11px] font-semibold text-muted hover:border-rose-400 hover:text-rose-700"
                title="Close uploaded CAD session and return to starter presets"
              >
                ✕ Close Uploaded File &amp; Show Presets
              </button>
            </div>
          ) : (
            <>
              <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-muted">
                Presets:
              </span>
              <button
                type="button"
                onClick={() => handleSelectPreset("stepped_shaft")}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                  activePreset === "stepped_shaft"
                    ? "border-brand bg-brand text-white shadow-2xs"
                    : "border-grid bg-plane text-ink hover:border-brand"
                )}
              >
                ⚙️ Stepped Shaft (EN8)
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset("thin_wall_bushing")}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                  activePreset === "thin_wall_bushing"
                    ? "border-amber-500 bg-amber-500 text-white shadow-2xs"
                    : "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-500"
                )}
              >
                ⚠️ Thin-Wall Bushing (DFM Demo)
              </button>
              <button
                type="button"
                onClick={() => handleSelectPreset("threaded_pin")}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                  activePreset === "threaded_pin"
                    ? "border-brand bg-brand text-white shadow-2xs"
                    : "border-grid bg-plane text-ink hover:border-brand"
                )}
              >
                🔩 Threaded Pin (SS 304)
              </button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            className="rounded-lg border border-brand bg-brand-light px-2.5 py-1 text-[11.5px] font-bold text-brand-dark hover:bg-brand hover:text-white"
          >
            📤 Upload CAD (.STEP / .STL)
          </button>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".step,.stp,.stl,.turncad,.json"
            className="hidden"
            onChange={(e) => {
              handleCadFileUpload(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={handleExportStep}
            className="rounded-lg border border-grid bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-ink hover:border-brand"
          >
            ⬇ .STEP (AP242)
          </button>
          <button
            type="button"
            onClick={() =>
              downloadFile(
                generateCadQueryPythonScript(doc),
                `${doc.part_name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_cadquery.py`,
                "text/x-python"
              )
            }
            className="rounded-lg border border-grid bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-ink hover:border-brand"
          >
            🐍 CadQuery .py
          </button>
          {onAddStepFileToQuote && (
            <button
              type="button"
              onClick={handleAddToQuoteCart}
              className="rounded-lg bg-brand px-3 py-1 text-[11.5px] font-bold text-white hover:bg-brand-dark"
            >
              + Add Part to Quote Order
            </button>
          )}
        </div>
      </div>

      {/* Main Full-Width Workstation Grid: Left = AI Chat (40%) | Right = 3D + Sliders + Quote (60%) */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-12 lg:items-stretch">
        {/* LEFT PANEL: AI LIVE CHAT WITH UNDO / REDO / REVERT */}
        <div className="flex h-[calc(100vh-165px)] min-h-[640px] max-h-[880px] flex-col overflow-hidden rounded-[10px] border border-grid bg-surface lg:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grid bg-plane px-3.5 py-2.5">
            <div>
              <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
                <span className="inline-block h-2 w-2 rounded-full bg-brand" />
                AI-CAD Live Machinist Chat
              </div>
              <div className="text-[10.5px] text-muted">
                Step {historyIdx + 1} of {history.length} · Revert truncates newer messages
              </div>
            </div>

            {/* Undo / Redo / Reset Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIdx <= 0}
                title="Undo last CAD change"
                className="rounded border border-grid bg-surface px-2 py-1 text-[11px] font-semibold text-ink hover:border-brand disabled:opacity-40"
              >
                ↩ Undo
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIdx >= history.length - 1}
                title="Redo CAD change"
                className="rounded border border-grid bg-surface px-2 py-1 text-[11px] font-semibold text-ink hover:border-brand disabled:opacity-40"
              >
                ↪ Redo
              </button>
              <button
                type="button"
                onClick={handleResetSession}
                title="Reset chat and model to initial state"
                className="rounded border border-grid bg-surface px-2 py-1 text-[11px] font-semibold text-rose-700 hover:border-rose-400"
              >
                ↺ Reset
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 space-y-2.5 overflow-y-auto p-3.5">
            {messages.map((m, idx) => {
              const isLatestAssistant =
                m.role === "assistant" && idx === messages.length - 1;
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex flex-col rounded-xl px-3.5 py-2.5 text-[12.5px] leading-relaxed",
                    m.role === "user"
                      ? "ml-8 bg-brand text-white"
                      : "mr-3 border border-grid bg-plane text-ink"
                  )}
                >
                  <div className="whitespace-pre-line">{m.content}</div>

                  {m.applied_changes && m.applied_changes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 border-t border-grid/60 pt-2">
                      {m.applied_changes.map((chg, cIdx) => (
                        <span
                          key={cIdx}
                          className="rounded bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800"
                        >
                          ✓ {chg}
                        </span>
                      ))}
                    </div>
                  )}

                  {m.clarifications && m.clarifications.length > 0 && (
                    <div className="mt-2 space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-amber-950">
                      {m.clarifications.map((c, cIdx) => (
                        <div key={cIdx}>
                          <div className="text-[11.5px] font-bold">
                            [{c.priority} Blocker] {c.question}
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {c.suggestions.map((s, sIdx) => (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() =>
                                  populatePromptWithoutSending(s.prompt_to_append)
                                }
                                className="rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-brand shadow-xs hover:bg-brand-light"
                                title="Click to place in input box (does not auto-send)"
                              >
                                ✎ {s.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    className={cn(
                      "mt-1.5 flex items-center justify-between text-[10px]",
                      m.role === "user" ? "text-white/75" : "text-muted"
                    )}
                  >
                    <span>{m.timestamp}</span>
                    {m.role === "assistant" && m.snapshot_doc && (
                      isLatestAssistant ? (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          ● Current Active Version
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRevertToMessage(m, idx)}
                          className="rounded border border-brand/30 bg-surface px-2 py-0.5 text-[10.5px] font-bold text-brand shadow-2xs hover:bg-brand hover:text-white"
                          title="Restore this 3D state and delete all messages after this one"
                        >
                          ⏪ Revert to this version
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Revert Confirmation Modal / Sheet */}
          {revertingTarget && (
            <div className="border-t border-amber-300 bg-amber-50/95 p-3 text-amber-950 backdrop-blur">
              <div className="flex items-start gap-2.5">
                <span className="text-base">⚠️</span>
                <div className="flex-1 text-[12px]">
                  <div className="font-bold text-amber-900">
                    Confirm Reverting 3D CAD Model?
                  </div>
                  <div className="mt-0.5 leading-relaxed text-amber-800">
                    Reverting to <strong className="font-semibold text-ink">&ldquo;{revertingTarget.partName}&rdquo;</strong> will restore its exact 3D geometry and permanently delete the <strong>{revertingTarget.subsequentCount} newer message{revertingTarget.subsequentCount > 1 ? "s" : ""}</strong> ahead of it.
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={confirmRevert}
                      className="rounded-md bg-rose-600 px-3 py-1 text-[11.5px] font-bold text-white shadow-xs hover:bg-rose-700"
                    >
                      Yes, Revert &amp; Delete Newer
                    </button>
                    <button
                      type="button"
                      onClick={cancelRevert}
                      className="rounded-md border border-amber-400 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick-Prompt Chips (Click to pre-fill input box without auto-sending) */}
          <div className="border-t border-grid bg-plane/60 px-3 py-2">
            <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-muted">
              <span>Try saying (click to edit in box before sending):</span>
              {promptInput && (
                <button
                  type="button"
                  onClick={() => setPromptInput("")}
                  className="text-rose-600 hover:underline"
                >
                  Clear input ✕
                </button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp}
                  type="button"
                  onClick={() => populatePromptWithoutSending(qp)}
                  className={cn(
                    "flex-none rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition",
                    promptInput === qp
                      ? "border-brand bg-brand-light font-semibold text-brand-dark"
                      : "border-grid bg-surface text-ink-2 hover:border-brand hover:text-brand"
                  )}
                >
                  ✎ {qp.length > 42 ? `${qp.slice(0, 42)}…` : qp}
                </button>
              ))}
            </div>
          </div>

          {/* User Message Input Window (Expanded Multi-Line Textarea) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendChatMessage();
            }}
            className="border-t border-grid bg-surface p-2.5"
          >
            <div className="relative rounded-xl border border-grid bg-plane p-2 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand">
              <textarea
                ref={promptInputRef}
                rows={3}
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
                placeholder="Describe the turned part or edit in plain English (e.g. Make a 120mm steel shaft, start at 60mm diameter, step last 40mm to 35mm, add M35x2 thread and a 16mm bore)…"
                className="w-full resize-y rounded-lg bg-transparent text-[13px] leading-relaxed text-ink outline-none placeholder:text-muted min-h-[72px] max-h-[180px]"
              />
              <div className="mt-1 flex flex-wrap items-center justify-between gap-1.5 border-t border-grid/60 pt-1.5 text-[11px] text-muted">
                <div className="flex items-center gap-1.5 text-[10.5px]">
                  <span>Press <kbd className="rounded border border-grid bg-surface px-1 py-0.5 font-semibold text-ink">Enter ↵</kbd> to Send &middot; <kbd className="rounded border border-grid bg-surface px-1 py-0.5 font-semibold text-ink">Shift+Enter</kbd> for newline</span>
                </div>
                <div className="flex items-center gap-2">
                  {promptInput.trim() && (
                    <button
                      type="button"
                      onClick={() => setPromptInput("")}
                      className="text-[11px] font-semibold text-muted hover:text-rose-600"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={sending || !promptInput.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-[12.5px] font-bold text-white transition-colors hover:bg-brand-dark disabled:opacity-40"
                  >
                    {sending ? (
                      <>
                        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Building…
                      </>
                    ) : (
                      <>Send Prompt &rarr;</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* RIGHT PANEL: 3D INSPECTOR + LIVE QUOTE + DFM CLICK-TO-FIX + WHAT-IF SLIDERS */}
        <div className="flex h-[calc(100vh-165px)] min-h-[640px] max-h-[880px] flex-col gap-3 lg:col-span-7">
          {/* 1. Interactive High-Res 3D & 2D Blueprint Canvas */}
          <Cad3DCanvas
            doc={doc}
            capp={capp}
            issues={issues}
            parsedModel={parsedModel}
            heightClass="h-[320px]"
          />

          {/* 2. Compact Live Price & Lead-Time Tier Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-grid bg-surface px-4 py-2.5">
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-muted">
                Live Smart Quote ({doc.quantity} pcs · {doc.material.grade_name})
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[21px] font-extrabold text-ink">
                  {formatInr(priceEstimate.tierObj.unit_price)}
                </span>
                <span className="text-[12px] text-muted">/ part</span>
                <span className="rounded-md bg-brand-light px-2 py-0.5 text-[11.5px] font-bold text-brand-dark">
                  Total: {formatInr(priceEstimate.tierObj.total)} + GST
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {priceEstimate.est.tiers.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSelectedTier(t.key)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-left transition",
                    selectedTier === t.key
                      ? "border-brand bg-brand-light text-brand-dark"
                      : "border-grid bg-plane text-ink-2 hover:border-brand"
                  )}
                >
                  <div className="text-[11px] font-bold">{t.label}</div>
                  <div className="text-[10px] text-muted">{t.lead_days} days</div>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Bottom Inspector Tabs: What-If Sliders | DFM Click-to-Fix | CAPP Plan | Canonical JSON */}
          <div className="flex flex-1 flex-col overflow-hidden rounded-[10px] border border-grid bg-surface">
            <div className="flex flex-wrap border-b border-grid px-3 pt-1.5 text-[12px] font-semibold">
              <button
                type="button"
                onClick={() => setActiveBottomTab("sliders")}
                className={cn(
                  "border-b-2 px-3 py-1.5",
                  activeBottomTab === "sliders"
                    ? "border-brand text-brand"
                    : "border-transparent text-ink-2 hover:text-ink"
                )}
              >
                🎚️ &ldquo;What-If&rdquo; Live Price Sliders
              </button>
              <button
                type="button"
                onClick={() => setActiveBottomTab("dfm")}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-1.5",
                  activeBottomTab === "dfm"
                    ? "border-brand text-brand"
                    : "border-transparent text-ink-2 hover:text-ink"
                )}
              >
                🛡️ DFM &ldquo;Click-to-Fix&rdquo;
                {issues.length > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] font-bold text-white",
                      issues.some((i) => i.severity === "error" || i.severity === "blocker")
                        ? "bg-rose-600"
                        : "bg-amber-500"
                    )}
                  >
                    {issues.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveBottomTab("capp")}
                className={cn(
                  "border-b-2 px-3 py-1.5",
                  activeBottomTab === "capp"
                    ? "border-brand text-brand"
                    : "border-transparent text-ink-2 hover:text-ink"
                )}
              >
                🔧 CAPP Sequence ({capp.operations.length} ops)
              </button>
              <button
                type="button"
                onClick={() => setActiveBottomTab("schema")}
                className={cn(
                  "border-b-2 px-3 py-1.5",
                  activeBottomTab === "schema"
                    ? "border-brand text-brand"
                    : "border-transparent text-ink-2 hover:text-ink"
                )}
              >
                📄 .turncad JSON
              </button>
            </div>

            <div className="max-h-[235px] overflow-y-auto p-3.5">
              {/* TAB 1: WHAT-IF LIVE PRICE SLIDERS */}
              {activeBottomTab === "sliders" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[10.5px] font-bold uppercase text-muted">
                        Material Grade
                      </label>
                      <select
                        value={doc.material.slug}
                        onChange={(e) => {
                          const slug = e.target.value as MaterialSlug;
                          setDoc((d) => ({ ...d, material: MATERIALS_CATALOG[slug] }));
                        }}
                        className="w-full rounded-lg border border-grid bg-plane px-2.5 py-1 text-[12px] font-medium"
                      >
                        {Object.values(MATERIALS_CATALOG).map((m) => (
                          <option key={m.slug} value={m.slug}>
                            {m.grade_name} (₹{m.rate_per_kg_inr}/kg)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-[10.5px] font-bold uppercase text-muted">
                        Order Quantity: <b className="text-ink">{doc.quantity} pcs</b>
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={250}
                        value={doc.quantity}
                        onChange={(e) =>
                          setDoc((d) => ({ ...d, quantity: Number(e.target.value) }))
                        }
                        className="w-full accent-brand"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[10.5px] font-bold uppercase text-muted">
                        Internal Bore:{" "}
                        <b className="text-ink">
                          {doc.bore.enabled ? `Ø${doc.bore.diameter_mm} mm` : "Solid (None)"}
                        </b>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={doc.bore.enabled}
                          onChange={(e) =>
                            setDoc((d) => ({
                              ...d,
                              bore: {
                                ...d.bore,
                                enabled: e.target.checked,
                                diameter_mm: e.target.checked
                                  ? Math.max(6, d.bore.diameter_mm || 12)
                                  : 0,
                              },
                            }))
                          }
                        />
                        {doc.bore.enabled && (
                          <input
                            type="range"
                            min={4}
                            max={Math.max(8, capp.max_od_mm - 1)}
                            step={0.5}
                            value={doc.bore.diameter_mm}
                            onChange={(e) =>
                              setDoc((d) => ({
                                ...d,
                                bore: { ...d.bore, diameter_mm: Number(e.target.value) },
                              }))
                            }
                            className="w-full accent-brand"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-grid rounded-lg border border-grid bg-plane/50">
                    {doc.segments.map((seg, idx) => (
                      <div
                        key={seg.id}
                        className="grid grid-cols-1 items-center gap-2.5 px-3 py-2 sm:grid-cols-12"
                      >
                        <div className="sm:col-span-3">
                          <div className="text-[11.5px] font-bold text-ink">
                            {idx + 1}. {seg.label}
                          </div>
                          <div className="text-[10px] text-muted">
                            Ref: {seg.semantic_ref.owner_feature}
                          </div>
                        </div>

                        <div className="sm:col-span-4">
                          <div className="flex justify-between text-[10.5px]">
                            <span className="text-muted">Outer Diameter</span>
                            <b className="text-ink">Ø{seg.diameter_mm} mm</b>
                          </div>
                          <input
                            type="range"
                            min={8}
                            max={140}
                            step={1}
                            value={seg.diameter_mm}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setDoc((d) => ({
                                ...d,
                                segments: d.segments.map((s) =>
                                  s.id === seg.id ? { ...s, diameter_mm: val } : s
                                ),
                              }));
                            }}
                            className="w-full accent-brand"
                          />
                        </div>

                        <div className="sm:col-span-4">
                          <div className="flex justify-between text-[10.5px]">
                            <span className="text-muted">Axial Length</span>
                            <b className="text-ink">{seg.length_mm} mm</b>
                          </div>
                          <input
                            type="range"
                            min={8}
                            max={150}
                            step={1}
                            value={seg.length_mm}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setDoc((d) => ({
                                ...d,
                                segments: d.segments.map((s) =>
                                  s.id === seg.id ? { ...s, length_mm: val } : s
                                ),
                              }));
                            }}
                            className="w-full accent-brand"
                          />
                        </div>

                        <div className="text-right sm:col-span-1">
                          {doc.segments.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setDoc((d) => ({
                                  ...d,
                                  segments: d.segments.filter((s) => s.id !== seg.id),
                                }))
                              }
                              title="Remove step"
                              className="text-[11px] font-bold text-rose-600 hover:underline"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: DFM CLICK-TO-FIX */}
              {activeBottomTab === "dfm" && (
                <div className="space-y-2.5">
                  {issues.length === 0 ? (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-900">
                      ✅ <b>All 7 Validation Layers Passed!</b> Wall thickness, boring bar reach ($L/D$), and slenderness ratios comply with ISO & workshop standards.
                    </div>
                  ) : (
                    issues.map((issue) => (
                      <div
                        key={issue.id}
                        className={cn(
                          "rounded-lg border p-3 text-[12px]",
                          issue.severity === "error" || issue.severity === "blocker"
                            ? "border-rose-300 bg-rose-50 text-rose-950"
                            : issue.severity === "warning"
                            ? "border-amber-300 bg-amber-50 text-amber-950"
                            : "border-sky-200 bg-sky-50 text-sky-950"
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <span className="mr-2 rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                              Tier {issue.layer} · {issue.severity}
                            </span>
                            <b className="text-[12.5px]">{issue.title}</b>
                          </div>
                          {issue.quick_fix?.savings_hint && (
                            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                              {issue.quick_fix.savings_hint}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11.5px] opacity-90">{issue.message}</p>
                        {issue.quick_fix && (
                          <div className="mt-2 flex flex-wrap items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => handleApplyQuickFix(issue.quick_fix!)}
                              className="rounded-lg bg-brand px-3 py-1 text-[11.5px] font-bold text-white shadow-xs hover:bg-brand-dark"
                            >
                              👉 {issue.quick_fix.label}
                            </button>
                            <span className="text-[10.5px] opacity-80">
                              {issue.quick_fix.description}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: CAPP PROCESS PLAN & CHUCK WORKHOLDING */}
              {activeBottomTab === "capp" && (
                <div className="space-y-2.5 text-[12px]">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg bg-plane p-2">
                      <div className="text-[10px] font-bold uppercase text-muted">
                        Bar Stock
                      </div>
                      <div className="mt-0.5 font-bold text-ink">
                        Ø{capp.recommended_stock.standard_diameter_mm} ×{" "}
                        {capp.recommended_stock.cut_length_mm} mm
                      </div>
                    </div>
                    <div className="rounded-lg bg-plane p-2">
                      <div className="text-[10px] font-bold uppercase text-muted">
                        Chuck Grip
                      </div>
                      <div className="mt-0.5 font-bold text-ink">
                        {capp.recommended_stock.chuck_grip_allowance_mm} mm (3-Jaw)
                      </div>
                    </div>
                    <div className="rounded-lg bg-plane p-2">
                      <div className="text-[10px] font-bold uppercase text-muted">
                        Setup 1 Torque
                      </div>
                      <div className="mt-0.5 font-bold text-emerald-700">
                        {capp.primary_setup.score}/100 ({capp.primary_setup.torque_capacity_nm} N·m)
                      </div>
                    </div>
                    <div className="rounded-lg bg-plane p-2">
                      <div className="text-[10px] font-bold uppercase text-muted">
                        Slenderness
                      </div>
                      <div className="mt-0.5 font-bold text-ink">
                        {capp.primary_setup.slenderness_ratio}:1
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-grid rounded-lg border border-grid">
                    {capp.operations.map((op) => (
                      <div
                        key={op.step}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5"
                      >
                        <div>
                          <span className="mr-2 font-bold text-brand">Op {op.step}0:</span>
                          <b className="text-ink">{op.operation}</b>
                          <span className="ml-2 text-[11px] text-muted">
                            ({op.tool} · {op.target_feature})
                          </span>
                        </div>
                        <span className="rounded bg-plane px-2 py-0.5 text-[10.5px] font-semibold text-ink-2">
                          ~{op.est_Minutes} min
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: CANONICAL .TURNCAD JSON SCHEMA */}
              {activeBottomTab === "schema" && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted">
                    <span>
                      Canonical Turning Document (<b>&lt; 2 KB</b>)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        downloadFile(
                          JSON.stringify(doc, null, 2),
                          `${doc.part_name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.turncad.json`,
                          "application/json"
                        )
                      }
                      className="font-semibold text-brand hover:underline"
                    >
                      Download .turncad.json
                    </button>
                  </div>
                  <pre className="max-h-[165px] overflow-auto rounded-lg bg-slate-900 p-2.5 text-[10.5px] text-sky-300">
                    {JSON.stringify(doc, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
