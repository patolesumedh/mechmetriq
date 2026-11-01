import { Sidebar } from "@/components/dashboard/Sidebar";
import { VendorStatusBanner } from "@/components/kyc/VendorStatusBanner";
import { loadCorrections, loadVendorPortal } from "@/lib/kyc/vendorPortal";
import { KYC_STATUS_LABEL } from "@/lib/kyc/status";
import { initialsFrom } from "./_lib/helpers";

export default async function RawMaterialVendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, vendor, switcher } = await loadVendorPortal("raw_material");
  const { remarks } = await loadCorrections(supabase, vendor);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        sectionLabel="Raw Material Vendor"
        switcher={switcher}
        items={[
          { label: "Overview", href: "/vendor/raw_material" },
          { label: "What I Supply", href: "/vendor/raw_material/supply" },
          { label: "Orders", href: "/vendor/raw_material/orders" },
          { label: "Earnings", href: "/vendor/raw_material/earnings" },
          { label: "KYC / Profile", href: "/vendor/raw_material/onboarding" },
        ]}
        footer={{
          initials: initialsFrom(vendor.company_name || "V"),
          name: vendor.company_name,
          subtitle: `Vendor · KYC ${KYC_STATUS_LABEL[vendor.kyc_status]}`,
        }}
      />
      <main className="flex-1 p-7">
        <VendorStatusBanner vendor={vendor} portal="raw_material" correctionCount={Object.keys(remarks).length} />
        {children}
      </main>
    </div>
  );
}
