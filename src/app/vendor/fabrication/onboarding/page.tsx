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

  const [{ data: vendorProfile }, { data: processOptions }, { data: materialOptions }, kycRow] =
    await Promise.all([
      supabase.from("vendor_profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("master_items")
        .select("*")
        .eq("type", "process")
        .eq("status", "active")
        .order("name"),
      supabase
        .from("master_items")
        .select("*")
        .eq("type", "material")
        .eq("status", "active")
        .is("parent_id", null)
        .order("name"),
      loadKycRow(supabase, user.id),
    ]);
  const kyc = toKycView(kycRow);

  if (!vendorProfile) redirect("/login");

  return (
    <div>
      <Topbar
        title="Onboarding / KYC"
        pill={{ label: "Machining / Fabrication", tone: "brand" }}
      />
      <div className="pt-6">
        <OnboardingForm
          vendorProfile={vendorProfile}
          kyc={kyc}
          processOptions={processOptions ?? []}
          materialOptions={materialOptions ?? []}
        />
        <PrivacyCard kyc={kyc} />
      </div>
    </div>
  );
}
