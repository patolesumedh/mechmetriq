import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Badge } from "@/components/ui/Badge";
import { listingStatusLabel, listingStatusTone } from "../../_lib/helpers";
import { ListingForm } from "../ListingForm";
import { updateListingAction, toggleListingStatusAction } from "./actions";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: listing } = await supabase.from("listings").select("*").eq("id", id).single();
  if (!listing || listing.vendor_id !== vendor.id) {
    redirect("/vendor/raw_material/listings");
  }

  const { data: materials } = await supabase
    .from("master_items")
    .select("id,name,parent_id,gst_rate,hsn_code,default_unit")
    .eq("type", "material")
    .eq("status", "active")
    .order("name");

  const canToggle = listing.status === "active" || listing.status === "inactive";

  return (
    <div>
      <Topbar
        title="Edit Listing"
        right={<Badge tone={listingStatusTone(listing.status)}>{listingStatusLabel(listing.status)}</Badge>}
      />
      <div className="mt-6">
        {canToggle && (
          <form action={toggleListingStatusAction} className="mb-4.5 flex justify-end">
            <input type="hidden" name="id" value={listing.id} />
            <input type="hidden" name="current_status" value={listing.status} />
            <button
              type="submit"
              className="rounded-lg border border-grid px-4 py-2 text-[12.5px] font-bold text-ink-2 hover:bg-plane"
            >
              {listing.status === "active" ? "Deactivate Listing" : "Reactivate Listing"}
            </button>
          </form>
        )}
        <ListingForm
          materials={materials ?? []}
          listing={listing}
          action={updateListingAction}
          submitLabel="Save Changes"
          pendingLabel="Saving…"
        />
      </div>
    </div>
  );
}
