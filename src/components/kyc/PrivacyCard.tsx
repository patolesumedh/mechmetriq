import { requestKycDeletionAction } from "@/lib/kyc/actions";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/kyc/rules";
import type { KycView } from "@/lib/kyc/server";

/** "Your data" card: deletion request + grievance contact (DPDP rights). */
export function PrivacyCard({ kyc }: { kyc: KycView }) {
  return (
    <div className="mt-6 max-w-[760px] rounded-[10px] border border-grid bg-surface p-6 text-[12.5px] text-ink-2">
      <h3 className="mb-1 text-[14.5px] font-semibold text-ink">Your data</h3>
      <p className="mb-3">
        You can ask us to delete your KYC details. We&rsquo;ll delete everything we are not
        required by law to keep (such as tax and invoice records), and you won&rsquo;t be able to
        receive orders afterwards. For any privacy concern or grievance, write to{" "}
        <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="font-semibold text-brand">
          {PRIVACY_CONTACT_EMAIL}
        </a>
        .
      </p>
      {kyc.deletionRequestedAt ? (
        <p className="font-medium text-ink">
          Deletion requested on{" "}
          {new Date(kyc.deletionRequestedAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
          . Our team will contact you.
        </p>
      ) : (
        <form action={requestKycDeletionAction}>
          <button
            type="submit"
            className="rounded-lg border border-crit px-3.5 py-2 text-[12.5px] font-semibold text-crit hover:bg-crit-bg"
          >
            Request deletion of my data
          </button>
        </form>
      )}
    </div>
  );
}
