import { redirect } from "next/navigation";

// The vendor-listing marketplace has been replaced by the platform-priced
// Raw Material Marketplace (shape → material → grade → size).
export default function MarketplaceRedirect() {
  redirect("/raw-materials");
}
