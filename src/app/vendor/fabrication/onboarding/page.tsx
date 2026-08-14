import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: vendorProfile }, { data: processOptions }, { data: materialOptions }] =
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
    ]);

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
          processOptions={processOptions ?? []}
          materialOptions={materialOptions ?? []}
          saved={saved === "1"}
        />
      </div>
    </div>
  );
}
