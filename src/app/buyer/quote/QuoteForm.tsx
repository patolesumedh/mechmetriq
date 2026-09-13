"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { createRfqAction, type QuoteFormState } from "./actions";
import type { Tables } from "@/lib/types/database";
import { cn } from "@/lib/cn";

const initialState: QuoteFormState = {};

const inputClass =
  "w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand";
const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-2";
const hintClass = "mt-1.5 text-[11.5px] text-muted";

const ACCEPTED_EXTENSIONS = ".step,.stp,.iges,.igs,.dwg,.dxf,.stl,.pdf,.png,.jpg,.jpeg";
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const SUBPROCESS_OPTIONS = [
  "No Preference",
  "CNC Milling",
  "CNC Turning (Lathe)",
  "CNC Mill and Turning Combo",
  "CNC Router",
  "Swiss-Type Turning",
  "Micro Machining",
  "Other",
];

const FINISH_OPTIONS = [
  "Standard",
  "Black Anodize",
  "Black Hardcoat Anodize",
  "Blue Anodize",
  "Clear Anodize",
  "Clear Hardcoat Anodize",
  "Gold Anodize",
  "Gray Hardcoat Anodize",
  "Green Anodize",
  "Orange Anodize",
  "PTFE Impregnated Hard Anodize",
  "Purple Anodize",
  "Red Anodize",
  "Yellow Anodize",
  "Chem Film Clear",
  "Chem Film Gold",
  "Case Harden",
  "Temper",
  "Through Harden",
  "Bead Blast",
  "Tumbled",
  "Electroless Nickel Plating",
  "Gold Plating",
  "Silver Plating",
  "Zinc Plating",
  "Electropolish",
  "Cerakote",
  "Powder Coating",
  "Other",
];

const TOLERANCE_OPTIONS = [
  '±0.010" (±0.25mm)',
  '±0.005" (±0.13mm)',
  'Tighter than ±0.005" (±0.13mm)',
];
const DEFAULT_TOLERANCE = TOLERANCE_OPTIONS[1];

const ROUGHNESS_OPTIONS = [
  "125μin / 3.2μm Ra",
  "63μin / 1.6μm Ra",
  "32μin / 0.8μm Ra",
  "16μin / 0.4μm Ra",
];
const DEFAULT_ROUGHNESS = ROUGHNESS_OPTIONS[0];

const PART_MARKING_OPTIONS = ["Silkscreen", "Ink Stamp", "Bag and Tag", "Engraving", "Laser Mark"];

const INSPECTION_OPTIONS = [
  "Standard Inspection",
  "Formal Inspection with Dimensional Report",
  "CMM Inspection with Dimensional Report",
  "First Article Inspection Report (FAIR AS9102)",
  "Source Inspection",
  "Build and Hold First Article Inspection",
  "Custom Inspection",
];
const DEFAULT_INSPECTION = INSPECTION_OPTIONS[0];

const CERTIFICATE_OPTIONS = [
  "ITAR/EAR Registration",
  "Cybersecurity Maturity Model Certification (CMMC)",
  "AS9100 Certified",
  "ISO 9001 Certified",
  "Hardware Certification",
  "Certificate of Conformance",
  "Material Traceability",
  "JCP/eJCP Certified",
  "Material Certification",
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileDropzone({ name }: { name: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  function applyFileList(list: FileList | null) {
    if (!list) return;
    const accepted: File[] = [];
    let oversized = false;
    Array.from(list).forEach((file) => {
      if (file.size > MAX_FILE_BYTES) {
        oversized = true;
        return;
      }
      accepted.push(file);
    });
    setWarning(oversized ? "One or more files were skipped — max size is 25MB each." : null);
    setFiles(accepted);

    // Keep the underlying <input> in sync so the accepted files (minus any
    // oversized ones we dropped) are what actually gets submitted.
    if (inputRef.current) {
      const dt = new DataTransfer();
      accepted.forEach((f) => dt.items.add(f));
      inputRef.current.files = dt.files;
    }
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    if (inputRef.current) {
      const dt = new DataTransfer();
      next.forEach((f) => dt.items.add(f));
      inputRef.current.files = dt.files;
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          applyFileList(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragOver ? "border-brand bg-brand-light" : "border-grid bg-plane hover:border-brand"
        )}
      >
        <span className="text-2xl">📎</span>
        <span className="text-[13px] font-semibold text-ink">
          Drop CAD files / drawings here, or click to browse
        </span>
        <span className="text-[11.5px] text-muted">
          STEP, IGES, DWG, DXF, STL, PDF, or images — up to 25MB each
        </span>
        <input
          ref={inputRef}
          type="file"
          name={name}
          multiple
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={(e) => applyFileList(e.target.files)}
        />
      </div>

      {warning && <div className="mt-2 text-[11.5px] font-medium text-[#a12525]">{warning}</div>}

      {files.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center justify-between gap-2 rounded-lg bg-plane px-3 py-2 text-[12.5px]"
            >
              <span className="truncate">
                {file.name} <span className="text-muted">({formatBytes(file.size)})</span>
              </span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="flex-none text-[11.5px] font-semibold text-[#a12525]"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CheckboxGroup({
  name,
  options,
  defaultSelected = [],
  scrollable = false,
}: {
  name: string;
  options: string[];
  defaultSelected?: string[];
  scrollable?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(defaultSelected);

  function toggle(opt: string) {
    setSelected((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-grid",
        scrollable && "max-h-[230px] overflow-y-auto"
      )}
    >
      {options.map((opt) => (
        <label
          key={opt}
          className="flex cursor-pointer items-center gap-2.5 border-b border-grid px-3.5 py-2.5 text-[13px] last:border-b-0 hover:bg-plane"
        >
          <input
            type="checkbox"
            name={name}
            value={opt}
            checked={selected.includes(opt)}
            onChange={() => toggle(opt)}
            className="h-3.5 w-3.5 flex-none accent-[var(--color-brand)]"
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

function ToggleQuantity({
  label,
  description,
  qtyName,
}: {
  label: string;
  description: string;
  qtyName: string;
}) {
  const [enabled, setEnabled] = useState(false);

  return (
    <div className="rounded-lg border border-grid p-3.5">
      <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-ink">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-3.5 w-3.5 accent-[var(--color-brand)]"
        />
        {label}
      </label>
      <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{description}</p>
      {enabled && (
        <div className="mt-2.5 max-w-[140px]">
          <label className={labelClass}>Total quantity</label>
          <input name={qtyName} type="number" min={1} defaultValue={1} className={inputClass} />
        </div>
      )}
    </div>
  );
}

export function QuoteForm({
  processes,
  materials,
  addresses,
}: {
  processes: Tables<"master_items">[];
  materials: Tables<"master_items">[];
  addresses: Tables<"addresses">[];
}) {
  const [state, formAction, pending] = useActionState(createRfqAction, initialState);

  return (
    <form
      action={formAction}
      className="max-w-[720px] rounded-[10px] border border-grid bg-surface p-6"
    >
      {state.error && (
        <div className="mb-4 rounded-lg bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-[#a12525]">
          {state.error}
        </div>
      )}

      <div className="mb-4">
        <label className={labelClass}>Mechanical drawings / CAD files</label>
        <FileDropzone name="cad_files" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3.5">
        <div>
          <label className={labelClass}>Manufacturing process *</label>
          <select name="process_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Select a process
            </option>
            {processes.map((p) => {
              const isLive = p.name.trim().toLowerCase() === "cnc machining";
              return (
                <option key={p.id} value={p.id} disabled={!isLive}>
                  {isLive ? p.name : `${p.name} (Coming Soon)`}
                </option>
              );
            })}
          </select>
          <p className={hintClass}>
            We&rsquo;re only quoting CNC Machining jobs right now &mdash; other processes are
            coming soon.
          </p>
        </div>
        <div>
          <label className={labelClass}>Material</label>
          <select name="material_id" defaultValue="" className={inputClass}>
            <option value="">Select a material</option>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className={labelClass}>Preferred subprocess</label>
        <select name="subprocess" defaultValue="No Preference" className={inputClass}>
          {SUBPROCESS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <p className={hintClass}>Applies to CNC Machining.</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3.5">
        <div>
          <label className={labelClass}>Quantity *</label>
          <input name="quantity" type="number" min={1} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Precision tolerance</label>
          <select name="tolerance" defaultValue={DEFAULT_TOLERANCE} className={inputClass}>
            {TOLERANCE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className={labelClass}>Finish</label>
        <p className={cn(hintClass, "mb-1.5 mt-0")}>Select all that apply.</p>
        <CheckboxGroup name="finish_options" options={FINISH_OPTIONS} defaultSelected={["Standard"]} scrollable />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3.5">
        <div>
          <label className={labelClass}>Colour / coating</label>
          <input
            name="colour_coating"
            type="text"
            placeholder="e.g. Matte black"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Precision surface roughness</label>
          <select name="surface_roughness" defaultValue={DEFAULT_ROUGHNESS} className={inputClass}>
            {ROUGHNESS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3.5">
        <ToggleQuantity
          label="My part requires threads and tapped holes"
          description="Attach a drawing that calls out thread type and depth to avoid delays."
          qtyName="threads_qty"
        />
        <ToggleQuantity
          label="My part requires inserts"
          description="Attach a drawing that calls out insert part number, quantity, and install location."
          qtyName="inserts_qty"
        />
      </div>

      <div className="mb-4">
        <label className={labelClass}>Part marking</label>
        <p className={cn(hintClass, "mb-1.5 mt-0")}>Select all that apply.</p>
        <CheckboxGroup name="part_marking" options={PART_MARKING_OPTIONS} />
      </div>

      <div className="mb-4">
        <label className={labelClass}>Inspection</label>
        <select name="inspection" defaultValue={DEFAULT_INSPECTION} className={inputClass}>
          {INSPECTION_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <p className={hintClass}>
          Inspection documentation won&rsquo;t ship with parts unless you choose an option with a
          dimensional report.
        </p>
      </div>

      <div className="mb-4">
        <label className={labelClass}>Certificates and supplier qualifications</label>
        <p className={cn(hintClass, "mb-1.5 mt-0")}>
          Select any required certificates. Applied to all parts in this order unless otherwise
          stated.
        </p>
        <CheckboxGroup name="certificates" options={CERTIFICATE_OPTIONS} />
      </div>

      <div className="mb-4">
        <label className={labelClass}>Preferred lead time</label>
        <select name="lead_time_pref" defaultValue="" className={inputClass}>
          <option value="">Select a lead time</option>
          <option value="Standard">Standard</option>
          <option value="Express">Express</option>
        </select>
      </div>

      <div className="mb-4">
        <label className={labelClass}>Delivery address</label>
        {addresses.length > 0 ? (
          <select name="delivery_address_id" defaultValue="" className={inputClass}>
            <option value="">Select an address</option>
            {addresses.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} — {a.full_address}
              </option>
            ))}
          </select>
        ) : (
          <div className="rounded-lg bg-warn-bg px-3.5 py-3 text-[12.5px] text-[#8a5a00]">
            You have no saved addresses yet.{" "}
            <Link href="/buyer/addresses" className="font-semibold underline">
              Add one first
            </Link>
            , or continue and add it later.
          </div>
        )}
      </div>

      <div className="mb-5">
        <label className={labelClass}>Special instructions / notes</label>
        <p className={cn(hintClass, "mb-1.5 mt-0")}>
          Additional specifications that would help us create your part &mdash; e.g. repeat part
          from a previous order, design changes, or anything outside the options above.
        </p>
        <textarea name="special_instructions" rows={4} className={inputClass} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-[9px] bg-brand px-5 py-3 text-[14.5px] font-bold text-white disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Get Quote"}
      </button>
    </form>
  );
}
