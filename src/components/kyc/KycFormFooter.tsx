"use client";

import Link from "next/link";
import { canEditKyc, canSubmitKyc, isUnderReview, type KycStatus, type Portal } from "@/lib/kyc/status";

/** Notice shown above the KYC form when it's read-only or needs corrections. */
export function KycFormNotice({
  status,
  portal,
  correctionSections,
}: {
  status: KycStatus;
  portal: Portal;
  correctionSections: string[];
}) {
  if (isUnderReview(status)) {
    return (
      <div className="mb-5 rounded-lg bg-warn-bg px-3.5 py-3 text-[13px] font-medium text-[#8a5a00]">
        Your application is with our team, so this form is locked. If anything needs changing, we&rsquo;ll ask
        for corrections.{" "}
        <Link href={`/vendor/${portal}/onboarding/review`} className="font-bold underline">
          View submitted application
        </Link>
      </div>
    );
  }
  if (status === "correction_required" && correctionSections.length) {
    return (
      <div className="mb-5 rounded-lg border border-[#f3c4c4] bg-crit-bg px-3.5 py-3 text-[13px] text-[#a12525]">
        <b>Corrections requested</b> in: {correctionSections.join(", ")}. Each remark is shown above its section.
        Fix them, save, then <b>Review &amp; submit</b> again.
      </div>
    );
  }
  return null;
}

/** Save + Review & submit buttons at the bottom of both KYC forms (F5.1). */
export function KycFormFooter({
  status,
  portal,
  pending,
}: {
  status: KycStatus;
  portal: Portal;
  pending: boolean;
}) {
  if (!canEditKyc(status)) return null;
  return (
    <div className="flex items-center justify-end gap-3">
      {canSubmitKyc(status) && (
        <span className="mr-auto text-[12px] text-muted">Save your changes before you review.</span>
      )}
      <button
        type="submit"
        disabled={pending}
        className={
          "rounded-lg px-5 py-3 text-[14.5px] font-bold disabled:opacity-60 " +
          (canSubmitKyc(status) ? "border border-brand text-brand" : "bg-brand text-white")
        }
      >
        {pending ? "Saving…" : canSubmitKyc(status) ? "Save" : "Save changes"}
      </button>
      {canSubmitKyc(status) && (
        <Link
          href={`/vendor/${portal}/onboarding/review`}
          className="rounded-lg bg-brand px-5 py-3 text-[14.5px] font-bold text-white"
        >
          Review &amp; submit &rarr;
        </Link>
      )}
    </div>
  );
}
