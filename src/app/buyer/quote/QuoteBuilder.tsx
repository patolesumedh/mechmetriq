"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { isStepFile } from "@/lib/smartQuote/shared";
import {
  estimatePart,
  formatInr,
  type GradeRate,
  type PartConfig,
  type PricingSettings,
} from "@/lib/smartQuote/pricing";
import {
  ACCEPTED_EXTENSIONS,
  CERTIFICATE_OPTIONS,
  DEFAULT_PART_CONFIG,
  FINISH_OPTIONS,
  INSPECTION_OPTIONS,
  MAX_FILE_BYTES,
  PART_MARKING_OPTIONS,
  ROUGHNESS_OPTIONS,
  SUBPROCESS_OPTIONS,
  TOLERANCE_OPTIONS,
} from "@/lib/smartQuote/options";
import {
  getPartAnalysisAction,
  startPartAnalysisAction,
  submitQuoteAction,
  type PartView,
} from "./actions";

type Config = typeof DEFAULT_PART_CONFIG;
type Status = "uploading" | "reading" | "ready" | "failed" | "manual";

interface Part {
  key: string;
  fileName: string;
  size: number;
  storagePath: string | null;
  analysisId: string | null;
  status: Status;
  error: string | null;
  view: PartView | null;
  gradeId: string;
  tier: string;
  config: Config;
  drawings: { name: string; path: string }[];
  startedAt: number;
}

const inputCls =
  "w-full rounded-lg border border-grid bg-surface px-3 py-2 text-[13px] outline-none focus:border-brand";
const labelCls = "mb-1 block text-[11.5px] font-semibold text-ink-2";
const POLL_MS = 3000;
const GIVE_UP_MS = 6 * 60 * 1000;

function fmtBytes(b: number) {
  return b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
const mm = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

async function uploadToStorage(userId: string, file: File) {
  const supabase = createClient();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from("rfq-attachments").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

// ====================================================================

export function QuoteBuilder({
  userId,
  addresses,
  grades,
  settings,
  instantEnabled,
}: {
  userId: string;
  addresses: { id: string; label: string; full_address: string }[];
  grades: GradeRate[];
  settings: PricingSettings | null;
  instantEnabled: boolean;
}) {
  const defaultGrade = useMemo(
    () => grades.find((g) => /6061/.test(g.name)) ?? grades.find((g) => g.material_slug === "aluminium") ?? grades[0],
    [grades]
  );
  const [parts, setParts] = useState<Part[]>([]);
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const partsRef = useRef(parts);
  useEffect(() => {
    partsRef.current = parts;
  }, [parts]);

  const patch = (key: string, p: Partial<Part> | ((x: Part) => Partial<Part>)) =>
    setParts((all) => all.map((x) => (x.key === key ? { ...x, ...(typeof p === "function" ? p(x) : p) } : x)));

  // Poll analyses that are still being read.
  useEffect(() => {
    const t = setInterval(async () => {
      for (const p of partsRef.current) {
        if (p.status !== "reading" || !p.analysisId) continue;
        if (Date.now() - p.startedAt > GIVE_UP_MS) {
          patch(p.key, { status: "failed", error: "Reading this file took too long. You can still request a quote." });
          continue;
        }
        const v = await getPartAnalysisAction(p.analysisId).catch(() => null);
        if (!v) continue;
        if (v.status === "completed") patch(p.key, { status: "ready", view: v, error: null });
        else if (v.status === "failed" || v.status === "stalled")
          patch(p.key, { status: "failed", view: v, error: v.error ?? "We couldn't read this file." });
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, []);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`"${file.name}" is over 25 MB and was skipped.`);
        continue;
      }
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const step = isStepFile(file.name);
      setParts((all) => [
        ...all,
        {
          key,
          fileName: file.name,
          size: file.size,
          storagePath: null,
          analysisId: null,
          status: "uploading",
          error: null,
          view: null,
          gradeId: defaultGrade?.id ?? "",
          tier: "standard",
          config: { ...DEFAULT_PART_CONFIG },
          drawings: [],
          startedAt: Date.now(),
        },
      ]);
      try {
        const path = await uploadToStorage(userId, file);
        if (!step || !instantEnabled) {
          patch(key, { storagePath: path, status: "manual" });
          continue;
        }
        const res = await startPartAnalysisAction(path);
        if (res.error || !res.id) patch(key, { storagePath: path, status: "manual", error: res.error ?? null });
        else patch(key, { storagePath: path, analysisId: res.id, status: "reading", startedAt: Date.now() });
      } catch (e) {
        patch(key, { status: "failed", error: `Upload failed: ${e instanceof Error ? e.message : "unknown error"}` });
      }
    }
  }

  async function addDrawings(key: string, list: FileList | null) {
    if (!list) return;
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) continue;
      try {
        const path = await uploadToStorage(userId, file);
        patch(key, (p) => ({ drawings: [...p.drawings, { name: file.name, path }] }));
      } catch (e) {
        setError(`Couldn't upload "${file.name}": ${e instanceof Error ? e.message : "error"}`);
      }
    }
  }

  const busy = parts.some((p) => p.status === "uploading" || p.status === "reading");
  const submittable = parts.filter((p) => p.storagePath);

  function submit() {
    setError(null);
    if (submittable.length === 0) return setError("Upload at least one part.");
    startSubmit(async () => {
      const res = await submitQuoteAction({
        deliveryAddressId: addressId,
        specialInstructions: notes,
        parts: submittable.map((p) => ({
          storagePath: p.storagePath!,
          analysisId: p.status === "ready" ? p.analysisId : null,
          drawingPaths: p.drawings.map((d) => d.path),
          gradeId: p.gradeId,
          tier: p.tier,
          config: p.config,
        })),
      });
      if (res?.error) setError(res.error);
    });
  }

  // Order total across priced parts (selected tiers).
  const priced = parts
    .map((p) => (p.status === "ready" ? quoteFor(p, grades, settings) : null))
    .filter((e): e is NonNullable<ReturnType<typeof quoteFor>> => !!e);
  const orderTotal = priced.reduce((sum, q) => sum + q.selected.total, 0);

  return (
    <div className="flex max-w-[1100px] flex-col gap-4">
      {error && (
        <div className="rounded-lg bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-[#a12525]">{error}</div>
      )}

      <Dropzone onFiles={addFiles} compact={parts.length > 0} instantEnabled={instantEnabled} />

      {parts.length > 0 && (
        <div className="rounded-[10px] border border-grid bg-surface">
          <div className="flex items-center justify-between border-b border-grid px-5 py-3 text-[13px]">
            <span className="font-semibold text-ink">
              {parts.length} part{parts.length > 1 ? "s" : ""} uploaded
            </span>
            {busy && <span className="text-muted">Reading files…</span>}
          </div>
          <div className="divide-y divide-grid">
            {parts.map((p, i) => (
              <PartCard
                key={p.key}
                index={i + 1}
                part={p}
                grades={grades}
                settings={settings}
                onChange={(x) => patch(p.key, x)}
                onRemove={() => setParts((all) => all.filter((x) => x.key !== p.key))}
                onDrawings={(l) => addDrawings(p.key, l)}
              />
            ))}
          </div>
        </div>
      )}

      {parts.length > 0 && (
        <div className="rounded-[10px] border border-grid bg-surface p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Delivery address</label>
              {addresses.length > 0 ? (
                <select value={addressId} onChange={(e) => setAddressId(e.target.value)} className={inputCls}>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} — {a.full_address}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-lg bg-warn-bg px-3 py-2.5 text-[12.5px] text-[#8a5a00]">
                  No saved address.{" "}
                  <Link href="/buyer/addresses" className="font-semibold underline">
                    Add one
                  </Link>{" "}
                  or continue and add it later.
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Notes for our team</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Repeat order, critical dimensions, anything else"
                className={inputCls}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-grid pt-4">
            <div className="text-[12.5px] text-ink-2">
              {priced.length > 0 ? (
                <>
                  Estimated total{" "}
                  <span className="text-[17px] font-extrabold text-ink">{formatInr(orderTotal)}</span>{" "}
                  <span className="text-muted">+ GST · confirmed by our team before you pay</span>
                </>
              ) : (
                <span className="text-muted">Our team will price parts that couldn&rsquo;t be read automatically.</span>
              )}
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || busy || submittable.length === 0}
              className="rounded-[9px] bg-brand px-5 py-3 text-[14px] font-bold text-white disabled:opacity-50"
            >
              {submitting ? "Submitting…" : busy ? "Waiting for files…" : "Request quote"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ====================================================================

function quoteFor(p: Part, grades: GradeRate[], settings: PricingSettings | null) {
  const grade = grades.find((g) => g.id === p.gradeId);
  if (!grade || !settings || !p.view?.geometry) return null;
  const cfg: PartConfig = {
    quantity: p.config.quantity,
    finish: p.config.finish,
    tolerance: p.config.tolerance,
    roughness: p.config.roughness,
    threads_qty: p.config.threads_qty,
    inserts_qty: p.config.inserts_qty,
    inspection: p.config.inspection,
    certificates: p.config.certificates,
    part_marking: p.config.part_marking,
  };
  const est = estimatePart(p.view.geometry, grade, cfg, settings);
  const selected = est.tiers.find((t) => t.key === p.tier) ?? est.tiers[1] ?? est.tiers[0];
  return { est, selected };
}

function Dropzone({
  onFiles,
  compact,
  instantEnabled,
}: {
  onFiles: (l: FileList | null) => void;
  compact: boolean;
  instantEnabled: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => ref.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border-2 border-dashed text-center transition-colors",
        compact ? "px-4 py-4" : "px-4 py-14",
        over ? "border-brand bg-brand-light" : "border-grid bg-surface hover:border-brand"
      )}
    >
      <span className="text-[14px] font-bold text-ink">
        {compact ? "+ Add more parts" : "Upload your CAD files for an instant quote"}
      </span>
      <span className="text-[12px] text-muted">
        {instantEnabled
          ? "STEP (.step, .stp) files are priced instantly · IGES, DWG, DXF, STL, PDF quoted by our team · up to 25 MB"
          : "STEP, IGES, DWG, DXF, STL, PDF or images · up to 25 MB · our team prices every part"}
      </span>
      <input
        ref={ref}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS}
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function PartCard({
  index,
  part: p,
  grades,
  settings,
  onChange,
  onRemove,
  onDrawings,
}: {
  index: number;
  part: Part;
  grades: GradeRate[];
  settings: PricingSettings | null;
  onChange: (x: Partial<Part>) => void;
  onRemove: () => void;
  onDrawings: (l: FileList | null) => void;
}) {
  const drawingRef = useRef<HTMLInputElement>(null);
  const setCfg = (c: Partial<Config>) => onChange({ config: { ...p.config, ...c } });
  const q = p.status === "ready" ? quoteFor(p, grades, settings) : null;
  const s = p.view?.summary;
  const geo = p.view?.geometry;

  const groups = useMemo(() => {
    const m = new Map<string, GradeRate[]>();
    for (const g of grades) m.set(g.material_name, [...(m.get(g.material_name) ?? []), g]);
    return [...m.entries()];
  }, [grades]);

  const featureLine = geo
    ? (
        [
          ["hole", "hole", "holes"],
          ["pocket", "pocket", "pockets"],
          ["slot", "slot", "slots"],
          ["thread", "thread", "threads"],
          ["edge", "chamfer or fillet", "chamfers & fillets"],
        ] as const
      )
        .map(([k, one, many]) => {
          const n = geo.features[k].firm + geo.features[k].candidate;
          return n ? `${n} ${n > 1 ? many : one}` : null;
        })
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="px-5 py-5">
      {/* header */}
      <div className="flex flex-wrap items-start gap-4">
        <span className="pt-1 text-[12.5px] font-semibold text-muted">{index}</span>
        <div className="flex h-[112px] w-[112px] flex-none items-center justify-center overflow-hidden rounded-lg border border-grid bg-plane">
          {p.view?.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.view.thumbnailUrl} alt={`Preview of ${p.fileName}`} className="h-full w-full object-contain" />
          ) : p.status === "uploading" || p.status === "reading" ? (
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-grid border-t-brand" aria-hidden />
          ) : (
            <span className="text-[11px] font-semibold uppercase text-muted">
              {p.fileName.split(".").pop()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-bold text-brand">{p.fileName}</div>
          <div className="mt-0.5 text-[12px] text-muted">{fmtBytes(p.size)}</div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => drawingRef.current?.click()}
              className="rounded-lg border border-grid px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-plane"
            >
              Upload drawings
            </button>
            <input
              ref={drawingRef}
              type="file"
              multiple
              accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                onDrawings(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={onRemove}
              className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 hover:bg-plane"
            >
              Remove part
            </button>
            {p.view?.status === "completed" && p.analysisId && (
              <a
                href={`/buyer/quotes/analysis/${p.analysisId}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-brand hover:bg-plane"
              >
                Full analysis ↗
              </a>
            )}
          </div>
          {p.drawings.length > 0 && (
            <div className="mt-2 text-[12px] text-ink-2">
              Drawings: {p.drawings.map((d) => d.name).join(", ")}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-ink-2">Quantity</span>
          <div className="flex items-center rounded-lg border border-grid">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setCfg({ quantity: Math.max(1, p.config.quantity - 1) })}
              className="px-3 py-2 text-[15px] text-ink-2 hover:bg-plane"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              value={p.config.quantity}
              onChange={(e) => setCfg({ quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
              className="w-[70px] border-x border-grid py-2 text-center text-[14px] font-semibold outline-none"
              aria-label="Quantity"
            />
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setCfg({ quantity: p.config.quantity + 1 })}
              className="px-3 py-2 text-[15px] text-ink-2 hover:bg-plane"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* body */}
      <div className="mt-5 grid gap-6 md:grid-cols-[1fr_380px]">
        <div>
          {s && (
            <div className="mb-4 rounded-lg bg-plane px-3.5 py-3 text-[12.5px] text-ink-2">
              <div>
                <b className="text-ink">Measurement:</b> {s.bbox_mm.map(mm).join(" × ")} mm ·{" "}
                {mm(s.volume_mm3 / 1000)} cm³
                {geo && <> · {geo.rotational ? "Turned part" : "Milled part"}</>}
              </div>
              {featureLine && (
                <div className="mt-0.5">
                  <b className="text-ink">Detected:</b> {featureLine}
                </div>
              )}
              {s.warnings.map((w) => (
                <div key={w} className="mt-1 text-[#8a5a00]">
                  {w}
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Process</label>
              <div className={cn(inputCls, "bg-plane")}>CNC Machining</div>
            </div>
            <div>
              <label className={labelCls}>Material</label>
              <select value={p.gradeId} onChange={(e) => onChange({ gradeId: e.target.value })} className={inputCls}>
                {groups.map(([material, gs]) => (
                  <optgroup key={material} label={material}>
                    {gs.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Finish</label>
              <select value={p.config.finish} onChange={(e) => setCfg({ finish: e.target.value })} className={inputCls}>
                {FINISH_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Precision tolerance</label>
              <select value={p.config.tolerance} onChange={(e) => setCfg({ tolerance: e.target.value })} className={inputCls}>
                {TOLERANCE_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          <details className="mt-3 rounded-lg border border-grid">
            <summary className="cursor-pointer px-3.5 py-2.5 text-[12.5px] font-semibold text-brand">
              More options — roughness, threads, inserts, inspection, certificates
            </summary>
            <div className="grid grid-cols-2 gap-3 border-t border-grid p-3.5">
              <div>
                <label className={labelCls}>Surface roughness</label>
                <select value={p.config.roughness} onChange={(e) => setCfg({ roughness: e.target.value })} className={inputCls}>
                  {ROUGHNESS_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Preferred subprocess</label>
                <select value={p.config.subprocess} onChange={(e) => setCfg({ subprocess: e.target.value })} className={inputCls}>
                  {SUBPROCESS_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Threads / tapped holes (count)</label>
                <input
                  type="number"
                  min={0}
                  value={p.config.threads_qty}
                  onChange={(e) => setCfg({ threads_qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Inserts (count)</label>
                <input
                  type="number"
                  min={0}
                  value={p.config.inserts_qty}
                  onChange={(e) => setCfg({ inserts_qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                  className={inputCls}
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Inspection</label>
                <select value={p.config.inspection} onChange={(e) => setCfg({ inspection: e.target.value })} className={inputCls}>
                  {INSPECTION_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Part marking</label>
                <Checks
                  options={PART_MARKING_OPTIONS}
                  value={p.config.part_marking}
                  onChange={(v) => setCfg({ part_marking: v })}
                />
              </div>
              <div>
                <label className={labelCls}>Certificates</label>
                <Checks
                  options={CERTIFICATE_OPTIONS}
                  value={p.config.certificates}
                  onChange={(v) => setCfg({ certificates: v })}
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Colour / coating notes</label>
                <input
                  value={p.config.colour_coating}
                  onChange={(e) => setCfg({ colour_coating: e.target.value })}
                  placeholder="e.g. Matte black"
                  className={inputCls}
                />
              </div>
            </div>
          </details>
        </div>

        {/* price */}
        <div>
          <div className="mb-2 text-[13px] font-bold text-ink">Price and lead time</div>
          {p.status === "uploading" && <Info>Uploading…</Info>}
          {p.status === "reading" && (
            <Info>
              Reading your part… usually 10–40 seconds. The first file after a quiet spell can take up to 2 minutes.
            </Info>
          )}
          {(p.status === "failed" || p.status === "manual") && (
            <Info tone="warn">
              {p.error ? `${p.error} ` : ""}
              {p.status === "manual" && !p.error
                ? "This file type is priced by our team. "
                : ""}
              Submit the request and we&rsquo;ll send a price within 24 hours.
            </Info>
          )}
          {q && (
            <div className="flex flex-col gap-2.5">
              {q.est.tiers.map((t) => {
                const active = t.key === q.selected.key;
                return (
                  <button
                    type="button"
                    key={t.key}
                    onClick={() => onChange({ tier: t.key })}
                    className={cn(
                      "flex items-start justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                      active ? "border-brand bg-brand-light/50 ring-1 ring-brand" : "border-grid hover:border-brand"
                    )}
                    aria-pressed={active}
                  >
                    <div>
                      <div className={cn("text-[13.5px] font-semibold", active ? "text-brand-dark" : "text-ink")}>
                        {t.label}
                      </div>
                      <div className="mt-1 text-[12.5px] text-ink-2">Arrives by {fmtDate(t.arrives_by)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] text-muted">{formatInr(t.unit_price, 2)} ea.</div>
                      <div className="text-[19px] font-extrabold text-ink">{formatInr(t.total)}</div>
                    </div>
                  </button>
                );
              })}
              <p className="text-[11.5px] leading-relaxed text-muted">
                Instant estimate, excl. GST. Our team confirms the final price before you pay.
                {q.est.notes.length > 0 && ` ${q.est.notes.join(" ")}`}
              </p>
            </div>
          )}
          {p.status === "ready" && !q && (
            <Info tone="warn">Pricing isn&rsquo;t available for this material. Our team will quote it.</Info>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return (
    <div
      className={cn(
        "rounded-lg px-3.5 py-3 text-[12.5px] leading-relaxed",
        tone === "warn" ? "bg-warn-bg text-[#8a5a00]" : "bg-plane text-ink-2"
      )}
    >
      {children}
    </div>
  );
}

function Checks({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="max-h-[150px] overflow-y-auto rounded-lg border border-grid">
      {options.map((o) => (
        <label key={o} className="flex cursor-pointer items-center gap-2 border-b border-grid px-2.5 py-1.5 text-[12px] last:border-b-0">
          <input
            type="checkbox"
            checked={value.includes(o)}
            onChange={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])}
            className="accent-[var(--color-brand)]"
          />
          {o}
        </label>
      ))}
    </div>
  );
}


