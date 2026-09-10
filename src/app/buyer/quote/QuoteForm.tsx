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

const ACCEPTED_EXTENSIONS = ".step,.stp,.iges,.igs,.dwg,.dxf,.stl,.pdf,.png,.jpg,.jpeg";
const MAX_FILE_BYTES = 25 * 1024 * 1024;

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
          <p className="mt-1.5 text-[11.5px] text-muted">
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

      <div className="mb-4 grid grid-cols-2 gap-3.5">
        <div>
          <label className={labelClass}>Quantity *</label>
          <input name="quantity" type="number" min={1} required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Tolerance</label>
          <input
            name="tolerance"
            type="text"
            placeholder="e.g. ±0.05mm"
            className={inputClass}
          />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3.5">
        <div>
          <label className={labelClass}>Surface finish</label>
          <input
            name="surface_finish"
            type="text"
            placeholder="e.g. Anodized"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Colour / coating</label>
          <input
            name="colour_coating"
            type="text"
            placeholder="e.g. Matte black"
            className={inputClass}
          />
        </div>
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
        <label className={labelClass}>Special instructions</label>
        <textarea name="special_instructions" rows={4} className={inputClass} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-[9px] bg-brand px-5 py-3 text-[14.5px] font-bold text-white disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit RFQ"}
      </button>
    </form>
  );
}
