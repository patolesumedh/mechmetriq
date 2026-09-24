"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { KYC_DOCS_BUCKET, KYC_DOC_ACCEPT, KYC_DOC_MAX_BYTES, KYC_DOC_TYPES } from "@/lib/kyc/rules";

type Doc = { path: string; name: string; previewUrl?: string; isImage: boolean };

function labelFor(path: string) {
  const base = path.split("/").pop() ?? path;
  return base.replace(/^\d+-(cheque|cert)-/, "");
}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

/**
 * Uploads KYC documents straight from the browser into the private
 * vendor-kyc-docs bucket (folder = the vendor's own id, enforced by storage
 * RLS) and submits only the object paths with the form. Files never become
 * public; previews of saved files use 60-second signed links.
 */
export function DocUpload({
  vendorId,
  name,
  kind,
  initialPaths,
  multiple = false,
  max = 1,
  error,
}: {
  vendorId: string;
  name: string;
  kind: "cheque" | "cert";
  initialPaths: string[];
  multiple?: boolean;
  max?: number;
  error?: string;
}) {
  const [docs, setDocs] = useState<Doc[]>(
    initialPaths.map((p) => ({ path: p, name: labelFor(p), isImage: !/\.pdf$/i.test(p) }))
  );
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setLocalError(null);
    const list = Array.from(files).slice(0, multiple ? max - docs.length : 1);
    for (const f of list) {
      if (!KYC_DOC_TYPES.includes(f.type)) {
        setLocalError("Only JPG, PNG or PDF files are allowed.");
        return;
      }
      if (f.size > KYC_DOC_MAX_BYTES) {
        setLocalError("Each file must be 5 MB or smaller.");
        return;
      }
    }
    setBusy(true);
    const supabase = createClient();
    const uploaded: Doc[] = [];
    for (const f of list) {
      const path = `${vendorId}/${Date.now()}-${kind}-${safeName(f.name)}`;
      const { error: upErr } = await supabase.storage
        .from(KYC_DOCS_BUCKET)
        .upload(path, f, { contentType: f.type, upsert: false });
      if (upErr) {
        setLocalError("Upload failed. Please try again.");
        break;
      }
      uploaded.push({
        path,
        name: f.name,
        isImage: f.type.startsWith("image/"),
        previewUrl: URL.createObjectURL(f),
      });
    }
    setBusy(false);
    setDocs((prev) => (multiple ? [...prev, ...uploaded] : uploaded.length ? uploaded : prev));
    if (inputRef.current) inputRef.current.value = "";
  }

  async function view(doc: Doc) {
    if (doc.previewUrl) {
      window.open(doc.previewUrl, "_blank", "noopener");
      return;
    }
    const { data } = await createClient()
      .storage.from(KYC_DOCS_BUCKET)
      .createSignedUrl(doc.path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  const canAdd = multiple ? docs.length < max : docs.length === 0;
  const shownError = localError ?? error;

  return (
    <div>
      {docs.map((d) => (
        <input key={d.path} type="hidden" name={name} value={d.path} />
      ))}

      {docs.length > 0 && (
        <ul className="mb-2.5 space-y-2">
          {docs.map((d) => (
            <li
              key={d.path}
              className="flex items-center gap-3 rounded-lg border border-grid px-3 py-2 text-[13px]"
            >
              {d.previewUrl && d.isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.previewUrl} alt="" className="h-10 w-14 rounded object-cover" />
              ) : (
                <span className="flex h-10 w-14 items-center justify-center rounded bg-brand-light text-[11px] font-bold text-brand-dark">
                  {d.isImage ? "IMG" : "PDF"}
                </span>
              )}
              <span className="flex-1 truncate font-medium text-ink">{d.name}</span>
              <button
                type="button"
                onClick={() => view(d)}
                className="text-[12.5px] font-semibold text-brand"
              >
                View
              </button>
              <button
                type="button"
                onClick={() => setDocs((prev) => prev.filter((x) => x.path !== d.path))}
                className="text-[12.5px] font-semibold text-crit"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        <label
          className={
            "flex cursor-pointer flex-col items-center justify-center rounded-lg border-[1.5px] border-dashed px-4 py-5 text-center " +
            (shownError ? "border-crit" : "border-grid hover:border-brand")
          }
        >
          <input
            ref={inputRef}
            type="file"
            accept={KYC_DOC_ACCEPT}
            multiple={multiple}
            disabled={busy}
            onChange={(e) => onFiles(e.target.files)}
            className="hidden"
          />
          <span className="text-[13px] font-semibold text-brand">
            {busy ? "Uploading…" : docs.length ? "Add another file" : "Upload or take a photo"}
          </span>
          <span className="mt-1 text-[11.5px] text-muted">JPG, PNG or PDF · max 5 MB</span>
        </label>
      )}
      {!canAdd && !multiple && (
        <p className="text-[11.5px] text-muted">Remove the file above to replace it.</p>
      )}
      {shownError && <p className="mt-1.5 text-[12px] text-crit">{shownError}</p>}
    </div>
  );
}
