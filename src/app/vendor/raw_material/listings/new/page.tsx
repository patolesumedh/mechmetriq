import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { ListingForm } from "../ListingForm";
import { createListingAction } from "./actions";

export default async function NewListingPage() {
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

  const { data: materials } = await supabase
    .from("master_items")
    .select("id,name,parent_id,gst_rate,hsn_code,default_unit")
    .eq("type", "material")
    .eq("status", "active")
    .order("name");

  return (
    <div>
      <Topbar title="Add Material Listing" />
      <div className="mt-6">
        <ListingForm
          materials={materials ?? []}
          action={createListingAction}
          submitLabel="Submit for Review →"
          pendingLabel="Saving…"
        />
      </div>
    </div>
  );
}
