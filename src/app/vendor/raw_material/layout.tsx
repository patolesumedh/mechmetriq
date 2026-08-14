import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Card } from "@/components/ui/Card";
import { initialsFrom } from "./_lib/helpers";

const KYC_BANNER_COPY: Record<string, string> = {
  draft: "Complete your KYC to start listing materials.",
  pending: "Your KYC is pending review by our team.",
  rejected: "Your KYC was rejected. Please review and resubmit your details.",
  on_hold: "Your KYC is on hold. Contact support for more details.",
};

export default async function RawMaterialVendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "vendor") redirect("/login");

  const { data: vendor } = await supabase
    .from("vendor_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!vendor || vendor.vendor_type !== "raw_material") redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar
        sectionLabel="Raw Material Vendor"
        items={[
          { label: "Overview", href: "/vendor/raw_material" },
          { label: "My Listings", href: "/vendor/raw_material/listings" },
          { label: "Orders", href: "/vendor/raw_material/orders" },
          { label: "Earnings", href: "/vendor/raw_material/earnings" },
          { label: "KYC / Profile", href: "/vendor/raw_material/onboarding" },
        ]}
        footer={{
          initials: initialsFrom(vendor.company_name || "V"),
          name: vendor.company_name,
          subtitle: `Vendor · ${vendor.kyc_status.replace("_", " ")}`,
        }}
      />
      <main className="flex-1 p-7">
        {vendor.kyc_status !== "approved" && (
          <Card className="mb-6 flex items-center justify-between gap-4 border-[#f5dfa6] bg-warn-bg px-5 py-3.5">
            <p className="text-[13px] font-semibold text-[#8a5a00]">
              <span className="mr-2 rounded-full bg-[#8a5a00] px-2.5 py-[3px] text-[11px] font-bold text-white">
                {vendor.kyc_status.replace("_", " ")}
              </span>
              {KYC_BANNER_COPY[vendor.kyc_status] ??
                "Complete your KYC to start listing materials."}
            </p>
            <Link
              href="/vendor/raw_material/onboarding"
              className="whitespace-nowrap text-[12.5px] font-bold text-brand"
            >
              Go to KYC &rarr;
            </Link>
          </Card>
        )}
        {children}
      </main>
    </div>
  );
}
