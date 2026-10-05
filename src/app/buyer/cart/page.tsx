import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { QuotesCartTabs } from "@/components/buyer/QuotesCartTabs";
import { toSettings } from "@/lib/rawMaterials/catalog";
import { inr, kg, num } from "@/lib/rawMaterials/format";
import { bulkPct, round } from "@/lib/rawMaterials/weight";
import { removeCartLineAction, updateCartLineAction } from "./actions";
import { PlaceOrderForm } from "./PlaceOrderForm";

export default async function CartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/buyer/cart");

  const [{ data: lines, error }, { data: settingsRow }, { data: addresses }] = await Promise.all([
    supabase.rpc("rm_cart_quote"),
    supabase.from("rm_settings").select("*").eq("id", 1).maybeSingle(),
    supabase
      .from("addresses")
      .select("id, label, full_address, pincode, is_default")
      .eq("profile_id", user.id)
      .order("is_default", { ascending: false }),
  ]);
  const settings = toSettings(settingsRow);
  const items = lines ?? [];
  const good = items.filter((l) => !l.error);
  const broken = items.length - good.length;

  const weight = good.reduce((s, l) => s + Number(l.weight_kg ?? 0), 0);
  const pct = bulkPct(settings, weight);
  let material = 0;
  let discount = 0;
  let cuts = 0;
  let mtc = 0;
  let gst = 0;
  for (const l of good) {
    const mv = Number(l.material_value);
    const d = round((mv * pct) / 100, 2);
    material += mv;
    discount += d;
    cuts += Number(l.cut_charge);
    mtc += Number(l.mtc_fee);
    gst += round(((mv - d + Number(l.cut_charge) + Number(l.mtc_fee)) * Number(l.gst_rate)) / 100, 2);
  }
  const subtotal = round(material - discount + cuts + mtc, 2);
  const belowMin = good.length > 0 && subtotal < settings.min_order_value;
  const nextTier = settings.bulk_tiers.filter((t) => t.min_kg > weight).sort((a, b) => a.min_kg - b.min_kg)[0];

  return (
    <>
      <div className="-mx-7 -mt-7 mb-7">
        <Topbar
          title="Quotes & Cart"
          pill={items.length ? { label: `${items.length} line${items.length === 1 ? "" : "s"}` } : undefined}
          right={
            <Link href="/raw-materials" className="text-[13px] font-semibold text-brand">
              + Add more material
            </Link>
          }
        />
      </div>
      <QuotesCartTabs active="cart" cartCount={items.length || undefined} />

      {error && (
        <Card className="mb-5 border-[#f3c4c4] bg-crit-bg px-5 py-3 text-[13px] text-[#a12525]">
          Could not load your cart: {error.message}
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-5 py-14 text-center">
          <p className="text-[14px] font-semibold text-ink">Your cart is empty.</p>
          <p className="text-[13px] text-ink-2">Browse bars, sheets, pipes and sections priced per kg.</p>
          <Link href="/raw-materials" className="rounded-lg bg-brand px-4 py-2.5 text-[13.5px] font-bold text-white">
            Browse raw materials
          </Link>
        </Card>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[1.7fr_1fr]">
          <Card>
            <CardHeader title="Items" />
            <div className="divide-y divide-grid">
              {items.map((l) => (
                <div key={l.cart_item_id} className="flex flex-col gap-2 px-5 py-4 text-[13px]">
                  {l.error ? (
                    <div className="text-[#a12525]">
                      <b>This line can&rsquo;t be ordered:</b> {l.error}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-ink">{l.description}</div>
                        <div className="mt-0.5 text-[12px] text-muted">
                          {l.sell_by === "kg"
                            ? `${kg(Number(l.weight_kg))} @ ${inr(Number(l.rate_per_kg), true)}/kg`
                            : `${num(Number(l.quantity), 0)} pcs × ${kg(Number(l.piece_weight_kg))} = ${kg(
                                Number(l.weight_kg)
                              )} @ ${inr(Number(l.rate_per_kg), true)}/kg`}
                          {l.cut && ` · cut to size ${inr(Number(l.cut_charge), true)}`}
                          {l.mtc && ` · MTC ${inr(Number(l.mtc_fee), true)}`}
                        </div>
                        {l.notes && <div className="mt-0.5 text-[12px] text-ink-2">Note: {l.notes}</div>}
                      </div>
                      <div className="text-right font-bold">
                        {inr(Number(l.material_value) + Number(l.cut_charge) + Number(l.mtc_fee), true)}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={updateCartLineAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={l.cart_item_id} />
                      <label className="flex items-center gap-1.5 text-[12px] text-ink-2">
                        Qty
                        <input
                          name="quantity"
                          type="number"
                          step="any"
                          min={0}
                          defaultValue={Number(l.quantity)}
                          className="w-20 rounded-md border border-grid px-2 py-1 text-[12.5px] outline-none focus:border-brand"
                        />
                        {l.sell_by === "kg" ? "kg" : "pcs"}
                      </label>
                      <label className="flex items-center gap-1.5 text-[12px] text-ink-2">
                        <input type="checkbox" name="mtc" defaultChecked={l.mtc} /> MTC
                      </label>
                      <button
                        type="submit"
                        className="rounded-md border border-grid px-2.5 py-1 text-[12px] font-semibold text-ink hover:bg-plane"
                      >
                        Update
                      </button>
                    </form>
                    <form action={removeCartLineAction}>
                      <input type="hidden" name="id" value={l.cart_item_id} />
                      <button type="submit" className="px-1.5 py-1 text-[12px] font-semibold text-[#a12525] hover:underline">
                        Remove
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="flex flex-col gap-4 p-5">
            <h3 className="text-[14.5px] font-semibold">Order summary</h3>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-[13px]">
              <dt className="text-ink-2">Total weight</dt>
              <dd className="text-right font-medium">{kg(weight)}</dd>
              <dt className="text-ink-2">Material</dt>
              <dd className="text-right font-medium">{inr(material, true)}</dd>
              {discount > 0 && (
                <>
                  <dt className="text-good">Bulk discount ({pct}%)</dt>
                  <dd className="text-right font-medium text-good">−{inr(discount, true)}</dd>
                </>
              )}
              {cuts > 0 && (
                <>
                  <dt className="text-ink-2">Cutting</dt>
                  <dd className="text-right font-medium">{inr(cuts, true)}</dd>
                </>
              )}
              {mtc > 0 && (
                <>
                  <dt className="text-ink-2">MTC</dt>
                  <dd className="text-right font-medium">{inr(mtc, true)}</dd>
                </>
              )}
              <dt className="border-t border-grid pt-2 text-ink-2">Subtotal</dt>
              <dd className="border-t border-grid pt-2 text-right font-medium">{inr(subtotal, true)}</dd>
              <dt className="text-ink-2">GST</dt>
              <dd className="text-right font-medium">{inr(gst, true)}</dd>
              <dt className="text-ink-2">Freight</dt>
              <dd className="text-right text-[12px] text-muted">confirmed on approval</dd>
              <dt className="border-t border-grid pt-2 text-[14.5px] font-bold">Total (excl. freight)</dt>
              <dd className="border-t border-grid pt-2 text-right text-[15px] font-extrabold">
                {inr(subtotal + gst, true)}
              </dd>
            </dl>
            {nextTier && good.length > 0 && (
              <p className="rounded-lg bg-brand-light px-3 py-2 text-[12px] text-brand-dark">
                Add {kg(nextTier.min_kg - weight)} more to get {nextTier.pct}% off material.
              </p>
            )}
            <PlaceOrderForm
              addresses={addresses ?? []}
              disabled={broken > 0 || belowMin || good.length === 0}
              disabledReason={
                broken > 0
                  ? "Remove or fix the lines that can't be ordered."
                  : belowMin
                    ? `Minimum order is ${inr(settings.min_order_value)} before GST.`
                    : undefined
              }
            />
          </Card>
        </div>
      )}
    </>
  );
}
