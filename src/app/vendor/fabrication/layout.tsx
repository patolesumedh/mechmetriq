import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Card } from "@/components/ui/Card";

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "V";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default async function FabricationVendorLayout({
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

  const { data: vendorProfile } = await supabase
    .from("vendor_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!vendorProfile || vendorProfile.vendor_type !== "fabrication") {
    redirect("/login");
  }

  const kycStatus = vendorProfile.kyc_status;

  return (
    <div className="flex min-h-screen">
      <Sidebar
        sectionLabel="Fabrication Vendor"
        items={[
          { label: "Overview", href: "/vendor/fabrication" },
          { label: "RFQ Inbox", href: "/vendor/fabrication/rfqs" },
          { label: "My Quotes", href: "/vendor/fabrication/quotes", soon: true },
          { label: "Jobs & Orders", href: "/vendor/fabrication/orders" },
          { label: "Earnings", href: "/vendor/fabrication/earnings" },
          { label: "KYC / Profile", href: "/vendor/fabrication/onboarding" },
        ]}
        footer={{
          initials: initialsFor(vendorProfile.company_name),
          name: vendorProfile.company_name,
          subtitle:
            kycStatus === "approved"
              ? "Vendor · KYC Verified"
              : kycStatus === "pending"
                ? "Vendor · KYC Pending"
                : kycStatus === "rejected"
                  ? "Vendor · KYC Rejected"
                  : kycStatus === "on_hold"
                    ? "Vendor · On Hold"
                    : "Vendor · Draft",
        }}
      />
      <main className="flex-1 p-7">
        {kycStatus !== "approved" && (
          <Card
            className={
              "mb-5 flex items-center justify-between px-5 py-3.5 text-[13px] font-medium " +
              (kycStatus === "rejected"
                ? "bg-crit-bg text-[#a12525]"
                : kycStatus === "on_hold"
                  ? "bg-warn-bg text-[#8a5a00]"
                  : kycStatus === "pending"
                    ? "bg-warn-bg text-[#8a5a00]"
                    : "bg-brand-light text-brand-dark")
            }
          >
            <span>
              {kycStatus === "pending" &&
                "Your KYC is submitted and pending review by the MECHmetrIQ team."}
              {kycStatus === "rejected" &&
                (vendorProfile.kyc_rejection_reason
                  ? `Your KYC was rejected: ${vendorProfile.kyc_rejection_reason}`
                  : "Your KYC was rejected. Please review and resubmit your details.")}
              {kycStatus === "on_hold" &&
                "Your vendor account is on hold. Contact support for details."}
              {kycStatus === "draft" &&
                "Complete your KYC to start receiving orders."}
            </span>
            <Link href="/vendor/fabrication/onboarding" className="font-bold underline">
              {kycStatus === "draft" ? "Complete KYC →" : "View KYC / Profile →"}
            </Link>
          </Card>
        )}
        {children}
      </main>
    </div>
  );
}
