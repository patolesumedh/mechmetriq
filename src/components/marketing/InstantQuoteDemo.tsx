"use client";

import { useEffect, useRef, useState } from "react";

type Frame = {
  file: { name: string; size: string } | null;
  process: string | null;
  material: string | null;
  quantity: string | null;
  leadTime: string | null;
  price: number;
  eta: string | null;
  hold: number;
};

const FILE = { name: "bracket_mount_v3.step", size: "2.4 MB" };

// A scripted walkthrough that loops forever: a file is dropped, each field
// fills in one at a time, the price counts up, then the buyer tweaks
// material + quantity and the price recalculates live before the whole
// thing resets and plays again. Purely decorative — no real quoting logic.
const FRAMES: Frame[] = [
  { file: null, process: null, material: null, quantity: null, leadTime: null, price: 0, eta: null, hold: 1700 },
  { file: FILE, process: null, material: null, quantity: null, leadTime: null, price: 0, eta: null, hold: 900 },
  { file: FILE, process: "CNC Machining", material: null, quantity: null, leadTime: null, price: 0, eta: null, hold: 750 },
  { file: FILE, process: "CNC Machining", material: "Al 6061", quantity: null, leadTime: null, price: 0, eta: null, hold: 750 },
  { file: FILE, process: "CNC Machining", material: "Al 6061", quantity: "50 pcs", leadTime: null, price: 0, eta: null, hold: 750 },
  { file: FILE, process: "CNC Machining", material: "Al 6061", quantity: "50 pcs", leadTime: "Standard", price: 0, eta: null, hold: 650 },
  { file: FILE, process: "CNC Machining", material: "Al 6061", quantity: "50 pcs", leadTime: "Standard", price: 18450, eta: "6–8 days", hold: 2700 },
  { file: FILE, process: "CNC Machining", material: "SS 304", quantity: "50 pcs", leadTime: "Standard", price: 18450, eta: "6–8 days", hold: 850 },
  { file: FILE, process: "CNC Machining", material: "SS 304", quantity: "120 pcs", leadTime: "Standard", price: 18450, eta: "6–8 days", hold: 850 },
  { file: FILE, process: "CNC Machining", material: "SS 304", quantity: "120 pcs", leadTime: "Standard", price: 41200, eta: "8–10 days", hold: 3100 },
];

// A frame index that represents "a fully filled-in, settled quote" — used
// as the static fallback when the visitor has reduced motion enabled.
const STATIC_FRAME_INDEX = 6;

function useCountUp(target: number) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (target === 0) {
      fromRef.current = 0;
      setDisplay(0);
      return;
    }

    const from = fromRef.current;
    const start = performance.now();
    const duration = 900;

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (target - from) * eased);
      setDisplay(value);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return display;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-grid px-3 py-2.5 text-[13px] text-ink-2">
      {label}:{" "}
      <span
        key={value ?? "empty"}
        className="animate-field-in inline-block font-medium text-ink"
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

export function InstantQuoteDemo() {
  const [frameIdx, setFrameIdx] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const frame = FRAMES[reduceMotion ? STATIC_FRAME_INDEX : frameIdx];
  const displayPrice = useCountUp(reduceMotion ? frame.price : frame.price);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setTimeout(() => {
      setFrameIdx((i) => (i + 1) % FRAMES.length);
    }, frame.hold);
    return () => clearTimeout(timer);
  }, [frameIdx, reduceMotion, frame.hold]);

  return (
    <div className="rounded-2xl border border-grid bg-surface p-[22px] shadow-[0_20px_50px_-20px_rgba(11,11,11,0.18)]">
      <div className="mb-4 flex items-center justify-between">
        <b>Instant Quote</b>
        <span className="flex items-center gap-1.5 rounded-md bg-good-bg px-2.5 py-1 text-xs font-bold text-good">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-good" />
          </span>
          Live pricing
        </span>
      </div>

      {frame.file ? (
        <div
          key="file-chip"
          className="animate-field-in mb-4 flex items-center gap-3 rounded-[10px] border border-good bg-good-bg p-4 text-left"
        >
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-good text-sm font-bold text-white">
            &#10003;
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold text-ink">{frame.file.name}</div>
            <div className="text-[11.5px] text-muted">{frame.file.size} &middot; uploaded</div>
          </div>
        </div>
      ) : (
        <div
          key="dropzone"
          className="animate-field-in mb-4 rounded-[10px] border border-dashed border-grid bg-plane p-6 text-center text-[13px] text-muted"
        >
          <b className="mb-1 block text-[14px] text-ink">Drop CAD file here</b>
          STEP &middot; STL &middot; IGES &middot; DXF &middot; PDF &mdash; up to 50MB
        </div>
      )}

      <div className="mb-2.5 grid grid-cols-2 gap-2.5">
        <Field label="Process" value={frame.process} />
        <Field label="Material" value={frame.material} />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Quantity" value={frame.quantity} />
        <Field label="Lead time" value={frame.leadTime} />
      </div>

      <div className="mt-3.5 flex items-center justify-between rounded-[10px] bg-brand-light px-4 py-3.5">
        <div>
          <div className="text-[11.5px] uppercase tracking-wide text-ink-2">Estimated price</div>
          <div className="text-[22px] font-extrabold text-brand-dark">
            &#8377;{displayPrice.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11.5px] uppercase tracking-wide text-ink-2">Lead time</div>
          <div key={frame.eta ?? "eta-empty"} className="animate-field-in text-sm font-bold">
            {frame.eta ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
