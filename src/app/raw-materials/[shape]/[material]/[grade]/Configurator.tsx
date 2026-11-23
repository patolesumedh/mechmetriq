"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { inr, kg } from "@/lib/rawMaterials/format";
import {
  bulkPct,
  previewLine,
  usesLength,
  validateDims,
  validateQuantity,
  type Dims,
  type PricingSettings,
  type ShapeForPricing,
} from "@/lib/rawMaterials/weight";
import { addToCartAction, type AddToCartState } from "./actions";

const inputClass =
  "w-full rounded-lg border border-grid bg-surface px-3 py-2.5 text-[13.5px] outline-none focus:border-brand";
const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-2";
const chipClass =
  "rounded-md border px-2 py-1 text-[11.5px] font-semibold transition-colors";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        chipClass +
        (active ? " border-brand bg-brand-light text-brand-dark" : " border-grid text-ink-2 hover:border-brand")
      }
    >
      {children}
    </button>
  );
}

export function Configurator({
  shapeId,
  gradeId,
  gradeName,
  mtcAvailable,
  shape,
  density,
  ratePerKg,
  settings,
  viewer,
  loginHref,
}: {
  shapeId: string;
  gradeId: string;
  gradeName: string;
  mtcAvailable: boolean;
  shape: ShapeForPricing;
  density: number;
  ratePerKg: number | null;
  settings: PricingSettings;
  viewer: "anon" | "buyer" | "other";
  loginHref: string;
}) {
  const isSheet = shape.formula === "sheet" || shape.formula === "perforated";
  const initialDims: Record<string, string> = {};
  for (const d of shape.dims) {
    const std = d.std ?? [];
    initialDims[d.key] = std.length ? String(std[Math.min(3, std.length - 1)]) : "";
  }
  if (isSheet && shape.std_sheet_sizes.length) {
    const [w, l] = shape.std_sheet_sizes[Math.min(1, shape.std_sheet_sizes.length - 1)];
    initialDims.w = String(w);
    initialDims.l = String(l);
  }
  const [dimsText, setDimsText] = useState<Record<string, string>>(initialDims);
  const [lengthText, setLengthText] = useState(
    usesLength(shape.formula) && shape.std_lengths.length ? String(shape.std_lengths[0]) : "1000"
  );
  const [qtyText, setQtyText] = useState(shape.sell_by === "kg" ? "100" : "1");
  const [mtc, setMtc] = useState(false);
  const [state, formAction, pending] = useActionState(addToCartAction, {} as AddToCartState);

  const dims: Dims = useMemo(
    () => Object.fromEntries(Object.entries(dimsText).map(([k, v]) => [k, v.trim() === "" ? NaN : Number(v)])),
    [dimsText]
  );
  const length = usesLength(shape.formula) ? Number(lengthText) : null;
  const qty = Number(qtyText);

  const problem = validateDims(shape, dims, length) ?? validateQuantity(shape, qty);
  const preview =
    !problem && ratePerKg !== null
      ? previewLine({ shape, density, ratePerKg, settings, dims, lengthMm: length, quantity: qty, mtc })
      : null;
  const lineTotal = preview ? preview.materialValue + preview.cutCharge + preview.mtcFee : 0;
  const nextTier = preview
    ? settings.bulk_tiers.filter((t) => t.min_kg > preview.weightKg).sort((a, b) => a.min_kg - b.min_kg)[0]
    : undefined;
  const pctNow = preview ? bulkPct(settings, preview.weightKg) : 0;

  const payloadDims = JSON.stringify(dims);

  return (
    <form action={formAction} className="rounded-xl border border-grid bg-surface">
      <input type="hidden" name="shape_id" value={shapeId} />
      <input type="hidden" name="grade_id" value={gradeId} />
      <input type="hidden" name="dims" value={payloadDims} />

      <div className="border-b border-grid px-5 py-4">
        <h2 className="text-[15px] font-bold">Configure {gradeName} {shape.name}</h2>
        <p className="text-[12.5px] text-muted">Weight and price update as you type.</p>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        {shape.dims.map((d) => {
          if (isSheet && (d.key === "w" || d.key === "l")) return null;
          const std = d.std ?? [];
          return (
            <div key={d.key}>
              <label htmlFor={`dim-${d.key}`} className={labelClass}>
                {d.label} ({d.unit})
              </label>
              {shape.formula === "ismc" ? (
                <select
                  id={`dim-${d.key}`}
                  className={inputClass}
                  value={dimsText[d.key]}
                  onChange={(e) => setDimsText({ ...dimsText, [d.key]: e.target.value })}
                >
                  {std.map((v) => (
                    <option key={v} value={v}>
                      ISMC {v}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    id={`dim-${d.key}`}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={d.min}
                    max={d.max}
                    list={`std-${d.key}`}
                    className={inputClass}
                    value={dimsText[d.key]}
                    onChange={(e) => setDimsText({ ...dimsText, [d.key]: e.target.value })}
                  />
                  <datalist id={`std-${d.key}`}>
                    {std.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                  {std.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {std.slice(0, 12).map((v) => (
                        <Chip
                          key={v}
                          active={Number(dimsText[d.key]) === v}
                          onClick={() => setDimsText({ ...dimsText, [d.key]: String(v) })}
                        >
                          {v}
                        </Chip>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {isSheet && (
          <div>
            <span className={labelClass}>Sheet size — width × length (mm)</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                aria-label="Width (mm)"
                type="number"
                inputMode="decimal"
                step="any"
                className={inputClass}
                value={dimsText.w}
                onChange={(e) => setDimsText({ ...dimsText, w: e.target.value })}
              />
              <input
                aria-label="Length (mm)"
                type="number"
                inputMode="decimal"
                step="any"
                className={inputClass}
                value={dimsText.l}
                onChange={(e) => setDimsText({ ...dimsText, l: e.target.value })}
              />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {shape.std_sheet_sizes.map(([w, l]) => (
                <Chip
                  key={`${w}x${l}`}
                  active={Number(dimsText.w) === w && Number(dimsText.l) === l}
                  onClick={() => setDimsText({ ...dimsText, w: String(w), l: String(l) })}
                >
                  {w} × {l}
                </Chip>
              ))}
            </div>
            <p className="mt-1 text-[11.5px] text-muted">Full sheet sizes ship uncut; any other size is cut to size.</p>
          </div>
        )}

        {usesLength(shape.formula) && shape.sell_by === "piece" && (
          <div>
            <label htmlFor="length_mm" className={labelClass}>
              Length per piece (mm)
            </label>
            <input
              id="length_mm"
              name="length_mm"
              type="number"
              inputMode="decimal"
              step="any"
              min={10}
              max={12000}
              className={inputClass}
              value={lengthText}
              onChange={(e) => setLengthText(e.target.value)}
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {shape.std_lengths.map((l) => (
                <Chip key={l} active={Number(lengthText) === l} onClick={() => setLengthText(String(l))}>
                  {l / 1000} m stock
                </Chip>
              ))}
            </div>
            <p className="mt-1 text-[11.5px] text-muted">Any other length is cut to length for you.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="quantity" className={labelClass}>
              Quantity ({shape.sell_by === "kg" ? "kg" : "pieces"})
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              inputMode="decimal"
              min={shape.sell_by === "kg" ? 10 : 1}
              step={shape.sell_by === "kg" ? "any" : 1}
              className={inputClass}
              value={qtyText}
              onChange={(e) => setQtyText(e.target.value)}
            />
          </div>
          <label
            className={
              "mt-6 flex items-center gap-2 rounded-lg border border-grid px-3 text-[13px] " +
              (mtcAvailable ? "has-[:checked]:border-brand has-[:checked]:bg-brand-light" : "opacity-50")
            }
          >
            <input
              type="checkbox"
              name="mtc"
              checked={mtc}
              disabled={!mtcAvailable}
              onChange={(e) => setMtc(e.target.checked)}
            />
            <span>
              <b className="block text-ink">Mill Test Certificate</b>
              <span className="text-[11.5px] text-muted">+{inr(settings.mtc_fee)} per line</span>
            </span>
          </label>
        </div>

        <div>
          <label htmlFor="notes" className={labelClass}>
            Notes for the supplier <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="notes"
            name="notes"
            maxLength={500}
            placeholder="e.g. bright finish, tolerance h9, deliver before 5 Oct"
            className={inputClass}
          />
        </div>
      </div>

      <div className="border-t border-grid bg-plane px-5 py-4" aria-live="polite">
        {problem ? (
          <p className="text-[13px] font-medium text-[#a12525]">{problem}</p>
        ) : ratePerKg === null ? (
          <p className="text-[13px] text-ink-2">This grade is priced on request — contact us for a quote.</p>
        ) : preview ? (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-[13px]">
            {preview.pieceWeightKg !== null && (
              <>
                <dt className="text-ink-2">Weight per piece</dt>
                <dd className="text-right font-medium">{kg(preview.pieceWeightKg)}</dd>
              </>
            )}
            <dt className="text-ink-2">Total weight</dt>
            <dd className="text-right font-medium">{kg(preview.weightKg)}</dd>
            <dt className="text-ink-2">Material @ {inr(preview.ratePerKg, true)}/kg</dt>
            <dd className="text-right font-medium">{inr(preview.materialValue, true)}</dd>
            {preview.cut && (
              <>
                <dt className="text-ink-2">Cut to size</dt>
                <dd className="text-right font-medium">{inr(preview.cutCharge, true)}</dd>
              </>
            )}
            {preview.mtcFee > 0 && (
              <>
                <dt className="text-ink-2">MTC</dt>
                <dd className="text-right font-medium">{inr(preview.mtcFee, true)}</dd>
              </>
            )}
            <dt className="mt-1 border-t border-grid pt-2 text-[14px] font-bold text-ink">Line total</dt>
            <dd className="mt-1 border-t border-grid pt-2 text-right text-[16px] font-extrabold">
              {inr(lineTotal, true)}
            </dd>
            <dd className="col-span-2 text-[11.5px] text-muted">
              Excl. GST and freight. Theoretical weight
              {pctNow > 0 ? ` · qualifies for ${pctNow}% bulk discount at checkout` : ""}
              {nextTier ? ` · order ${nextTier.min_kg} kg+ in total for ${nextTier.pct}% off` : ""}.
            </dd>
          </dl>
        ) : null}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-grid px-5 py-4">
        {state.error && !state.needsLogin && (
          <p role="alert" className="rounded-lg bg-crit-bg px-3 py-2 text-[12.5px] font-medium text-[#a12525]">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p role="status" className="rounded-lg bg-good-bg px-3 py-2 text-[12.5px] font-medium text-[#0a6b0a]">
            Added to cart.{" "}
            <Link href="/buyer/cart" className="font-bold underline">
              View cart
            </Link>{" "}
            or add another size.
          </p>
        )}
        {viewer === "anon" || state.needsLogin ? (
          <Link
            href={loginHref}
            className="rounded-[9px] bg-brand py-3 text-center text-[14.5px] font-bold text-white hover:bg-brand-dark"
          >
            Log in to add to cart
          </Link>
        ) : viewer === "other" ? (
          <p className="rounded-lg bg-warn-bg px-3 py-2 text-[12.5px] text-[#8a5a00]">
            You&rsquo;re signed in with a vendor or admin account. Use a buyer account to order.
          </p>
        ) : (
          <button
            type="submit"
            disabled={pending || !!problem || ratePerKg === null}
            className="rounded-[9px] bg-brand py-3 text-[14.5px] font-bold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {pending ? "Adding…" : "Add to cart"}
          </button>
        )}
        {viewer === "anon" && (
          <p className="text-center text-[12px] text-muted">
            New here?{" "}
            <Link href="/register" className="font-semibold text-brand">
              Create a free buyer account
            </Link>
          </p>
        )}
      </div>
    </form>
  );
}
