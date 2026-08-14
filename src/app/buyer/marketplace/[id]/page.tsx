import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "../../_lib/ui";
import { buyNowAction } from "./actions";

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: listing } = await supabase.from("listings").select("*").eq("id", id).single();
  if (!listing || listing.status !== "active") notFound();

  const { data: vendor } = await supabase
    .from("vendor_profiles")
    .select("company_name, rating, typical_lead_time")
    .eq("id", listing.vendor_id)
    .single();

  const lookupIds = [listing.category_id, listing.material_id].filter(
    (v): v is string => Boolean(v)
  );
  const { data: items } = await supabase
    .from("master_items")
    .select("id, name")
    .in("id", lookupIds);
  const itemMap = new Map((items ?? []).map((i) => [i.id, i.name]));

  return (
    <>
      <div className="-mx-7 -mt-7 mb-7">
        <Topbar title={listing.title} />
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] gap-5">
        <Card className="p-6">
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
            {itemMap.get(listing.category_id ?? "") ?? "Material"}
            {listing.material_id && ` · ${itemMap.get(listing.material_id) ?? ""}`}
          </div>
          <h2 className="mb-3 text-xl font-bold text-ink">{listing.title}</h2>
          <p className="mb-5 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">
            {listing.description || "No description provided."}
          </p>
          {listing.dimensions_spec && (
            <div className="mb-4 rounded-lg bg-plane px-4 py-3 text-[13px] text-ink-2">
              <b className="text-ink">Dimensions / spec: </b>
              {listing.dimensions_spec}
            </div>
          )}
          <div className="text-[13px] text-ink-2">
            Sold by <b className="text-ink">{vendor?.company_name ?? "Vendor"}</b>
            {vendor?.typical_lead_time && ` · Typical lead time ${vendor.typical_lead_time}`}
            {vendor?.rating != null && ` · ★ ${vendor.rating.toFixed(1)}`}
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-6">
          <div>
            <div className="text-[26px] font-extrabold text-ink">
              {formatCurrency(listing.price_per_unit)}
              <span className="text-[13px] font-medium text-muted"> /{listing.unit}</span>
            </div>
            <div className="mt-1 text-[12.5px] text-ink-2">
              Min. order {listing.min_order_qty} {listing.unit} · {listing.available_stock}{" "}
              {listing.unit} available
            </div>
          </div>

          <form action={buyNowAction} className="flex flex-col gap-3">
            <input type="hidden" name="listing_id" value={listing.id} />
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
                Quantity ({listing.unit})
              </label>
              <input
                name="quantity"
                type="number"
                min={listing.min_order_qty}
                max={listing.available_stock}
                defaultValue={listing.min_order_qty}
                required
                className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand"
              />
            </div>
            <button
              type="submit"
              disabled={listing.available_stock < listing.min_order_qty}
              className="rounded-[9px] bg-brand py-3 text-[14.5px] font-bold text-white disabled:opacity-50"
            >
              Buy Now
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}
