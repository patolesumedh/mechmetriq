import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { Tables } from "@/lib/types/database";
import { KYC_STATUS_LABEL, type Portal } from "@/lib/kyc/status";

/** Status banner shown on every vendor page until the KYC is approved (F5.3). */
export function VendorStatusBanner({
  vendor,
  portal,
  correctionCount,
}: {
  vendor: Tables<"vendor_profiles">;
  portal: Portal;
  correctionCount: number;
}) {
  const s = vendor.kyc_status;
  if (s === "approved") return null;

  const app = vendor.application_id ? `Application ${vendor.application_id}` : "Your application";
  const tone =
    s === "rejected" || s === "correction_required"
      ? "bg-crit-bg text-[#a12525]"
      : s === "pending" || s === "under_review"
        ? "bg-warn-bg text-[#8a5a00]"
        : "bg-brand-light text-brand-dark";

  const text =
    s === "draft"
      ? "Complete your KYC, then Review & submit it to start receiving orders."
      : s === "pending"
        ? `${app} is submitted and waiting for review by the MECHmetrIQ team.`
        : s === "under_review"
          ? `${app} is under review by the MECHmetrIQ team.`
          : s === "correction_required"
            ? `Our team asked for corrections in ${correctionCount} section${correctionCount === 1 ? "" : "s"}. Fix them and resubmit.`
            : s === "rejected"
              ? vendor.kyc_status_reason || vendor.kyc_rejection_reason
                ? `Your KYC was rejected: ${vendor.kyc_status_reason || vendor.kyc_rejection_reason}. Update your details and resubmit.`
                : "Your KYC was rejected. Update your details and resubmit."
              : "Your vendor account is suspended. Contact support for details.";

  const cta =
    s === "draft" ? "Complete KYC →" : s === "correction_required" ? "See what to fix →" : "View KYC / Profile →";

  return (
    <Card className={"mb-5 flex items-center justify-between gap-4 px-5 py-3.5 text-[13px] font-medium " + tone}>
      <span>
        <span className="mr-2 rounded-full bg-white/70 px-2.5 py-[3px] text-[11px] font-bold">
          {KYC_STATUS_LABEL[s]}
        </span>
        {text}
      </span>
      <Link href={`/vendor/${portal}/onboarding`} className="whitespace-nowrap font-bold underline">
        {cta}
      </Link>
    </Card>
  );
}
