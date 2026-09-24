import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { OnboardingForm } from "./OnboardingForm";
import { PrivacyCard } from "@/components/kyc/PrivacyCard";
import { loadKycRow, toKycView } from "@/lib/kyc/server";

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
  const kyc = toKycView(await loadKycRow(supabase, user.id));

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
        <OnboardingForm vendor={vendor} kyc={kyc} materials={materials ?? []} />
        <PrivacyCard kyc={kyc} />
      </div>
    </div>
  );
}
