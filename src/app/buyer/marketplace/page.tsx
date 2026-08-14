import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "../_lib/ui";

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const supabase = await createClient();

  let listingsQuery = supabase
    .from("listings")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (category) {
    listingsQuery = listingsQuery.eq("category_id", category);
  }
  const { data: listings } = await listingsQuery;
  const allListings = listings ?? [];

  const categoryIds = allListings
    .map((l) => l.category_id)
    .filter((v): v is string => Boolean(v));
  const materialIds = allListings
    .map((l) => l.material_id)
    .filter((v): v is string => Boolean(v));
  const itemIds = Array.from(new Set([...categoryIds, ...materialIds]));
  const { data: items } = await supabase.from("master_items").select("id, name").in("id", itemIds);
  const itemMap = new Map((items ?? []).map((i) => [i.id, i.name]));

  const vendorIds = Array.from(new Set(allListings.map((l) => l.vendor_id)));
  const { data: vendors } = await supabase
    .from("vendor_profiles")
    .select("id, company_name")
    .in("id", vendorIds);
  const vendorMap = new Map((vendors ?? []).map((v) => [v.id, v.company_name]));

  const { data: categories } = await supabase
    .from("master_items")
    .select("id, name")
    .eq("type", "material")
    .eq("status", "active")
    .is("parent_id", null)
    .order("name");

  return (
    <>
      <div className="-mx-7 -mt-7 mb-7">
        <Topbar title="Marketplace" />
      </div>

      {categories && categories.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Link
            href="/buyer/marketplace"
            className={
              "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold " +
              (!category ? "border-brand bg-brand-light text-brand-dark" : "border-grid text-ink-2")
            }
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/buyer/marketplace?category=${c.id}`}
              className={
                "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold " +
                (category === c.id
                  ? "border-brand bg-brand-light text-brand-dark"
                  : "border-grid text-ink-2")
              }
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {allListings.length > 0 ? (
        <div className="grid grid-cols-3 gap-4">
          {allListings.map((listing) => (
            <Link key={listing.id} href={`/buyer/marketplace/${listing.id}`}>
              <Card className="flex h-full flex-col p-4">
                <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
                  {itemMap.get(listing.material_id ?? "") ?? "Material"}
                </div>
                <h3 className="mb-1 text-[14.5px] font-bold text-ink">{listing.title}</h3>
                <div className="mb-3 text-[12.5px] text-ink-2">
                  {vendorMap.get(listing.vendor_id) ?? "Vendor"}
                </div>
                <div className="mt-auto flex items-end justify-between">
                  <div>
                    <div className="text-[17px] font-extrabold text-ink">
                      {formatCurrency(listing.price_per_unit)}
                      <span className="text-[12px] font-medium text-muted"> /{listing.unit}</span>
                    </div>
                    <div className="text-[11.5px] text-muted">
                      Min. order {listing.min_order_qty} {listing.unit}
                    </div>
                  </div>
                  <div className="text-[11.5px] font-semibold text-good">
                    {listing.available_stock} in stock
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-3 px-5 py-14 text-center">
          <p className="text-[13.5px] text-ink-2">No listings available right now.</p>
        </Card>
      )}
    </>
  );
}
