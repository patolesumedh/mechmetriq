import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Tables } from "@/lib/types/database";
import {
  KYC_STATUS_LABEL,
  REVIEW_SECTIONS,
  VENDOR_TYPE_LABEL,
  parseRemarks,
  type KycStatus,
} from "@/lib/kyc/status";
import { kycTone } from "../../_lib/format";
import { kycDecisionAction, resolveDuplicateAction, setVendorTypeAction } from "./actions";

const textarea =
  "w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13px] outline-none focus:border-brand";

function fmt(ts: string | null | undefined) {
  return ts ? new Date(ts).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function ActionButton({
  vendorId,
  action,
  label,
  variant = "primary",
}: {
  vendorId: string;
  action: string;
  label: string;
  variant?: "primary" | "outline";
}) {
  return (
    <form action={kycDecisionAction}>
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="action" value={action} />
      <Button type="submit" variant={variant} className="w-full">
        {label}
      </Button>
    </form>
  );
}

function ReasonForm({
  vendorId,
  action,
  label,
  placeholder,
}: {
  vendorId: string;
  action: string;
  label: string;
  placeholder: string;
}) {
  return (
    <form action={kycDecisionAction} className="space-y-2 border-t border-grid pt-3">
      <input type="hidden" name="vendorId" value={vendorId} />
      <input type="hidden" name="action" value={action} />
      <label className="block text-[12px] font-semibold text-ink-2">{label} — reason (shown to the vendor)</label>
      <textarea name="reason" rows={3} required placeholder={placeholder} className={textarea} />
      <Button type="submit" variant="outline" className="w-full border-crit text-crit hover:bg-crit-bg">
        {label}
      </Button>
    </form>
  );
}

/** Status-aware review actions (F5.3 / F5.4). */
export function KycDecisionCard({
  vendor,
  reviewerName,
}: {
  vendor: Tables<"vendor_profiles">;
  reviewerName: string | null;
}) {
  const s: KycStatus = vendor.kyc_status;
  const reviewable = s === "pending" || s === "under_review";

  return (
    <Card>
      <CardHeader title="KYC Review" />
      <div className="space-y-3 p-5">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-ink-2">Status:</span>
          <Badge tone={kycTone(s)}>{KYC_STATUS_LABEL[s]}</Badge>
        </div>
        <div className="space-y-1 text-[12.5px] text-ink-2">
          <div>
            Application ID: <b className="font-mono text-ink">{vendor.application_id ?? "—"}</b>
          </div>
          <div>Submitted: {fmt(vendor.submitted_at)}</div>
          <div>
            Last reviewed: {fmt(vendor.kyc_reviewed_at)}
            {reviewerName ? ` by ${reviewerName}` : ""}
          </div>
        </div>
        {(vendor.kyc_status_reason || (s === "rejected" && vendor.kyc_rejection_reason)) && (
          <div className="rounded-lg bg-crit-bg px-3.5 py-3 text-[12.5px] text-[#a12525]">
            <b>Reason given:</b> {vendor.kyc_status_reason || vendor.kyc_rejection_reason}
          </div>
        )}

        {s === "draft" && (
          <p className="text-[12.5px] text-muted">The vendor hasn&rsquo;t submitted their application yet.</p>
        )}
        {s === "correction_required" && (
          <p className="text-[12.5px] text-muted">Waiting for the vendor to fix the requested sections and resubmit.</p>
        )}

        {s === "pending" && (
          <ActionButton vendorId={vendor.id} action="start_review" label="Start review" variant="outline" />
        )}
        {reviewable && <ActionButton vendorId={vendor.id} action="approve" label="Approve" />}

        {reviewable && (
          <details className="rounded-lg border border-grid px-3.5 py-2.5">
            <summary className="cursor-pointer text-[13px] font-semibold text-ink">Request corrections…</summary>
            <form action={kycDecisionAction} className="mt-3 space-y-3">
              <input type="hidden" name="vendorId" value={vendor.id} />
              <input type="hidden" name="action" value="request_correction" />
              <p className="text-[12px] text-muted">
                Fill in only the sections the vendor needs to fix. They&rsquo;ll see each remark above that section.
              </p>
              {REVIEW_SECTIONS.map((sec) => (
                <div key={sec.key}>
                  <label className="mb-1 block text-[12px] font-semibold text-ink-2">{sec.label}</label>
                  <textarea name={`remark_${sec.key}`} rows={2} maxLength={1000} className={textarea} />
                </div>
              ))}
              <Button type="submit" variant="outline" className="w-full">
                Send correction request
              </Button>
            </form>
          </details>
        )}

        {(reviewable || s === "correction_required") && (
          <ReasonForm
            vendorId={vendor.id}
            action="reject"
            label="Reject"
            placeholder="Explain why this application is being rejected…"
          />
        )}
        {s === "approved" && (
          <ReasonForm
            vendorId={vendor.id}
            action="suspend"
            label="Suspend"
            placeholder="Why is this vendor being suspended? Orders, listings and supply are blocked while suspended."
          />
        )}
        {(s === "suspended" || s === "on_hold") && (
          <ActionButton vendorId={vendor.id} action="reactivate" label="Reactivate vendor" />
        )}
      </div>
    </Card>
  );
}

export function VendorTypeCard({ vendor }: { vendor: Tables<"vendor_profiles"> }) {
  return (
    <Card>
      <CardHeader title="Vendor Type" />
      <form action={setVendorTypeAction} className="space-y-3 p-5">
        <input type="hidden" name="vendorId" value={vendor.id} />
        <select name="vendor_type" defaultValue={vendor.vendor_type} className={textarea}>
          {(["fabrication", "raw_material", "both"] as const).map((t) => (
            <option key={t} value={t}>
              {VENDOR_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <p className="text-[11.5px] text-muted">
          &ldquo;Both&rdquo; lets the vendor switch between the fabrication and raw-material portals with one login.
        </p>
        <Button type="submit" variant="outline" className="w-full">
          Save type
        </Button>
      </form>
    </Card>
  );
}

export type ReviewRow = Tables<"vendor_kyc_reviews"> & { actor_name: string | null };

const ACTION_LABEL: Record<string, string> = {
  submitted: "Application submitted",
  review_started: "Review started",
  correction_requested: "Corrections requested",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
  reactivated: "Reactivated",
  type_changed: "Vendor type changed",
};

export function ReviewHistoryCard({ reviews }: { reviews: ReviewRow[] }) {
  return (
    <Card>
      <CardHeader title="Review History" />
      <div className="p-5">
        {reviews.length === 0 ? (
          <p className="text-[13px] text-muted">No review activity yet.</p>
        ) : (
          <ol className="space-y-3.5">
            {reviews.map((r) => {
              const remarks = parseRemarks(r.remarks);
              return (
                <li key={r.id} className="border-l-2 border-grid pl-3.5 text-[13px]">
                  <div className="font-semibold text-ink">{ACTION_LABEL[r.action] ?? r.action}</div>
                  <div className="text-[12px] text-muted">
                    {fmt(r.created_at)}
                    {r.actor_name ? ` · ${r.actor_name}` : ""}
                  </div>
                  {r.reason && <div className="mt-1 text-ink-2">{r.reason}</div>}
                  {Object.keys(remarks).length > 0 && (
                    <ul className="mt-1.5 space-y-1 text-[12.5px] text-ink-2">
                      {REVIEW_SECTIONS.filter((s) => remarks[s.key]).map((s) => (
                        <li key={s.key}>
                          <b>{s.label}:</b> {remarks[s.key]}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Card>
  );
}

export type DuplicateRow = {
  id: number;
  field: string;
  other_id: string;
  other_name: string;
  detected_at: string;
};

/** Possible duplicate vendors — same GSTIN or same PAN (F5.2). */
export function DuplicatesPanel({ vendorId, flags }: { vendorId: string; flags: DuplicateRow[] }) {
  if (!flags.length) return null;
  return (
    <div className="rounded-[10px] border border-[#f3c4c4] bg-crit-bg p-5 text-[13px] text-[#a12525]">
      <div className="mb-2 font-bold">Possible duplicate vendor</div>
      <ul className="space-y-2.5">
        {flags.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Same <b>{f.field === "gstin" ? "GSTIN" : "PAN"}</b> as{" "}
              <Link href={`/admin/vendors/${f.other_id}`} className="font-semibold underline">
                {f.other_name}
              </Link>{" "}
              <span className="text-[12px] opacity-80">(found {fmt(f.detected_at)})</span>
            </span>
            <form action={resolveDuplicateAction} className="flex items-center gap-2">
              <input type="hidden" name="vendorId" value={vendorId} />
              <input type="hidden" name="flagId" value={f.id} />
              <input
                name="note"
                placeholder="Note, e.g. same company, other state"
                className="w-[260px] rounded-lg border border-[#f3c4c4] bg-white px-3 py-1.5 text-[12.5px] text-ink outline-none"
              />
              <button type="submit" className="rounded-lg bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#a12525]">
                Mark as checked
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
