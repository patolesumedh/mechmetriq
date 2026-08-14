import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vendor } = await supabase
    .from("vendor_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!vendor) redirect("/login");

  const { data: materials } = await supabase
    .from("master_items")
    .select("id,name")
    .eq("type", "material")
    .eq("status", "active")
    .is("parent_id", null)
    .order("name");

  return (
    <div>
      <Topbar
        title="KYC / Profile"
        pill={{
          label: vendor.kyc_status.replace("_", " "),
          tone: vendor.kyc_status === "approved" ? "brand" : "orange",
        }}
      />
      <div className="mt-6">
        <OnboardingForm vendor={vendor} materials={materials ?? []} />
      </div>
    </div>
  );
}
