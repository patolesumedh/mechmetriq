import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { formatINR, listingStatusLabel, listingStatusTone } from "../_lib/helpers";

export default async function ListingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vendor } = await supabase
    .from("vendor_profiles")
    .select("id")
    .eq("id", user.id)
    .single();
  if (!vendor) redirect("/login");

  const { data: listings } = await supabase
    .from("listings")
    .select("id,title,material_id,price_per_unit,unit,available_stock,status")
    .eq("vendor_id", vendor.id)
    .order("created_at", { ascending: false });

  const materialIds = Array.from(
    new Set((listings ?? []).map((l) => l.material_id).filter((id): id is string => !!id))
  );
  const { data: materials } =
    materialIds.length > 0
      ? await supabase.from("master_items").select("id,name").in("id", materialIds)
      : { data: [] as { id: string; name: string }[] };
  const materialNameById = new Map((materials ?? []).map((m) => [m.id, m.name]));

  return (
    <div>
      <Topbar
        title="My Listings"
        right={
          <ButtonLink href="/vendor/raw_material/listings/new">+ Add Listing</ButtonLink>
        }
      />

      <div className="mt-6">
        <Card>
          {(listings ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-muted">
              You haven&rsquo;t created any listings yet.
            </p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Title
                  </th>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Material
                  </th>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Price
                  </th>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Stock
                  </th>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Status
                  </th>
                  <th className="border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted" />
                </tr>
              </thead>
              <tbody>
                {(listings ?? []).map((l) => (
                  <tr key={l.id}>
                    <td className="border-b border-grid px-5 py-3 text-[13px] font-semibold">
                      {l.title}
                    </td>
                    <td className="border-b border-grid px-5 py-3 text-[13px] text-ink-2">
                      {l.material_id ? (materialNameById.get(l.material_id) ?? "—") : "—"}
                    </td>
                    <td className="border-b border-grid px-5 py-3 text-[13px] text-ink-2">
                      {formatINR(l.price_per_unit)} / {l.unit}
                    </td>
                    <td className="border-b border-grid px-5 py-3 text-[13px] text-ink-2">
                      {l.available_stock} {l.unit}
                    </td>
                    <td className="border-b border-grid px-5 py-3 text-[13px]">
                      <Badge tone={listingStatusTone(l.status)}>{listingStatusLabel(l.status)}</Badge>
                    </td>
                    <td className="border-b border-grid px-5 py-3 text-right text-[13px]">
                      <Link
                        href={`/vendor/raw_material/listings/${l.id}`}
                        className="font-semibold text-brand"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
