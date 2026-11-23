import { Sidebar } from "@/components/dashboard/Sidebar";
import { VendorStatusBanner } from "@/components/kyc/VendorStatusBanner";
import { loadCorrections, loadVendorPortal } from "@/lib/kyc/vendorPortal";
import { KYC_STATUS_LABEL } from "@/lib/kyc/status";

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
  const { supabase, vendor, switcher } = await loadVendorPortal("fabrication");
  const { remarks } = await loadCorrections(supabase, vendor);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        sectionLabel="Fabrication Vendor"
        switcher={switcher}
        items={[
          { label: "Overview", href: "/vendor/fabrication" },
          { label: "RFQ Inbox", href: "/vendor/fabrication/rfqs" },
          { label: "My Quotes", href: "/vendor/fabrication/quotes", soon: true },
          { label: "Jobs & Orders", href: "/vendor/fabrication/orders" },
          { label: "Earnings", href: "/vendor/fabrication/earnings" },
          { label: "KYC / Profile", href: "/vendor/fabrication/onboarding" },
        ]}
        footer={{
          initials: initialsFor(vendor.company_name),
          name: vendor.company_name,
          subtitle: `Vendor · KYC ${KYC_STATUS_LABEL[vendor.kyc_status]}`,
        }}
      />
      <main className="flex-1 p-7">
        <VendorStatusBanner vendor={vendor} portal="fabrication" correctionCount={Object.keys(remarks).length} />
        {children}
      </main>
    </div>
  );
}
