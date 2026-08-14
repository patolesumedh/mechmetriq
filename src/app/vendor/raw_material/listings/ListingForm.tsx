"use client";

import { useActionState, useMemo, useState } from "react";
import type { Tables } from "@/lib/types/database";

export interface ListingFormState {
  error?: string;
}

export type MaterialOption = Pick<
  Tables<"master_items">,
  "id" | "name" | "parent_id" | "gst_rate" | "hsn_code" | "default_unit"
>;

const inputClass =
  "w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand";
const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-2";

export function ListingForm({
  materials,
  listing,
  action,
  submitLabel,
  pendingLabel,
}: {
  materials: MaterialOption[];
  listing?: Tables<"listings">;
  action: (prevState: ListingFormState, formData: FormData) => Promise<ListingFormState>;
  submitLabel: string;
  pendingLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ListingFormState);

  const materialsById = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials]);
  const topLevel = useMemo(() => materials.filter((m) => !m.parent_id), [materials]);
  const childrenByParent = useMemo(() => {
    const map = new Map<string, MaterialOption[]>();
    for (const m of materials) {
      if (m.parent_id) {
        const list = map.get(m.parent_id) ?? [];
        list.push(m);
        map.set(m.parent_id, list);
      }
    }
    return map;
  }, [materials]);

  const [materialId, setMaterialId] = useState(listing?.material_id ?? "");
  const [unit, setUnit] = useState(listing?.unit ?? "");
  const [gstRate, setGstRate] = useState(listing ? String(listing.gst_rate) : "");
  const [hsnCode, setHsnCode] = useState(listing?.hsn_code ?? "");

  function handleMaterialChange(id: string) {
    setMaterialId(id);
    const m = materialsById.get(id);
    if (m) {
      if (m.gst_rate !== null && m.gst_rate !== undefined) setGstRate(String(m.gst_rate));
      if (m.hsn_code) setHsnCode(m.hsn_code);
      if (m.default_unit && !unit) setUnit(m.default_unit);
    }
  }

  return (
    <form action={formAction} className="grid grid-cols-[1.4fr_1fr] items-start gap-5">
      {listing && <input type="hidden" name="id" value={listing.id} />}
      <div>
        {state.error && (
          <div className="mb-4 rounded-lg bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-[#a12525]">
            {state.error}
          </div>
        )}

        <div className="mb-4.5 rounded-[10px] border border-grid bg-surface p-6">
          <h3 className="mb-1 text-[14.5px] font-semibold">Product Details</h3>
          <p className="mb-4.5 text-[12.5px] text-muted">
            These details appear on your marketplace listing.
          </p>

          <div className="mb-3.5">
            <label className={labelClass}>
              Product title <span className="text-crit">*</span>
            </label>
            <input
              name="title"
              required
              defaultValue={listing?.title}
              placeholder="e.g. Al 6061 Sheet, 2mm"
              className={inputClass}
            />
          </div>

          <div className="mb-3.5 grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                Material &amp; grade <span className="text-crit">*</span>
              </label>
              <select
                name="material_id"
                required
                value={materialId}
                onChange={(e) => handleMaterialChange(e.target.value)}
                className={inputClass}
              >
                <option value="">Select material…</option>
                {topLevel.map((top) => {
                  const children = childrenByParent.get(top.id) ?? [];
                  if (children.length === 0) {
                    return (
                      <option key={top.id} value={top.id}>
                        {top.name}
                      </option>
                    );
                  }
                  return (
                    <optgroup key={top.id} label={top.name}>
                      {children.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <div>
              <label className={labelClass}>
                Dimensions / spec <span className="text-crit">*</span>
              </label>
              <input
                name="dimensions_spec"
                required
                defaultValue={listing?.dimensions_spec ?? ""}
                placeholder="e.g. 4×8 ft, 2mm"
                className={inputClass}
              />
            </div>
          </div>

          <div className="mb-3.5 grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>
                Unit <span className="text-crit">*</span>
              </label>
              <input
                name="unit"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. kg, pcs, m"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                GST rate (%) <span className="text-crit">*</span>
              </label>
              <input
                name="gst_rate"
                type="number"
                step="0.01"
                required
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
                placeholder="e.g. 18"
                className={inputClass}
              />
            </div>
          </div>

          <div className="mb-3.5 grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>
                Price per unit (₹) <span className="text-crit">*</span>
              </label>
              <input
                name="price_per_unit"
                type="number"
                step="0.01"
                required
                defaultValue={listing?.price_per_unit}
                placeholder="e.g. 340"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                Min. order qty <span className="text-crit">*</span>
              </label>
              <input
                name="min_order_qty"
                type="number"
                step="0.01"
                required
                defaultValue={listing?.min_order_qty}
                placeholder="e.g. 5"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>
                Available stock <span className="text-crit">*</span>
              </label>
              <input
                name="available_stock"
                type="number"
                step="0.01"
                required
                defaultValue={listing?.available_stock ?? 0}
                placeholder="e.g. 480"
                className={inputClass}
              />
            </div>
          </div>

          <div className="mb-3.5 grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Low-stock alert threshold</label>
              <input
                name="low_stock_threshold"
                type="number"
                step="0.01"
                defaultValue={listing?.low_stock_threshold ?? ""}
                placeholder="e.g. 20"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>HSN code</label>
              <input
                name="hsn_code"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
                placeholder="e.g. 7606"
                className={inputClass}
              />
            </div>
          </div>

          <div className="mb-3.5">
            <label className={labelClass}>Image URLs (comma-separated)</label>
            <input
              name="image_urls"
              defaultValue={(listing?.image_urls ?? []).join(", ")}
              placeholder="https://…/image1.jpg, https://…/image2.jpg"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              name="description"
              rows={3}
              defaultValue={listing?.description ?? ""}
              placeholder="Grade, tolerance, certifications, etc."
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div>
        <div className="rounded-[10px] border border-grid bg-surface p-6">
          <label className="mb-3.5 flex items-center justify-between text-[12.5px] font-semibold text-ink-2">
            Auto-publish on save
            <input
              type="checkbox"
              name="auto_publish"
              defaultChecked={listing?.auto_publish ?? false}
              className="h-4 w-4"
            />
          </label>
          <div className="mb-3.5 rounded-lg bg-warn-bg px-3.5 py-3 text-[12px] leading-relaxed text-[#8a5a00]">
            &#9432; Unless auto-published, listings go to &ldquo;Pending Admin Review&rdquo;
            before appearing on the marketplace.
          </div>
          <button
            type="submit"
            disabled={pending}
            className="block w-full rounded-lg bg-brand py-3 text-center text-[13.5px] font-bold text-white disabled:opacity-60"
          >
            {pending ? pendingLabel : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
