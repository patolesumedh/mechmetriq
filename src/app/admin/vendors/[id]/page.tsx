import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDate, kycTone, titleCase } from "../../_lib/format";
import {
  approveVendorAction,
  rejectVendorAction,
  holdVendorAction,
  updateVendorMetaAction,
} from "./actions";

export default async function AdminVendorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  const { id } = await params;
  const { msg, error } = await searchParams;

  const supabase = await createClient();

  const [{ data: vendor }, { data: profile }] = await Promise.all([
    supabase.from("vendor_profiles").select("*").eq("id", id).single(),
    supabase
      .from("profiles")
      .select("full_name, email, phone, created_at")
      .eq("id", id)
      .single(),
  ]);

  if (!vendor) notFound();

  const isFabrication = vendor.vendor_type === "fabrication";
  const skillTags = isFabrication ? vendor.capabilities : vendor.materials_handled;

  return (
    <div>
      <Topbar
        title={vendor.company_name}
        pill={{
          label: titleCase(vendor.kyc_status),
          tone: vendor.kyc_status === "approved" ? "brand" : "orange",
        }}
        right={
          <Link href="/admin/vendors" className="text-[13px] font-semibold text-brand">
            &larr; Back to vendors
          </Link>
        }
      />

      <div className="mt-6 space-y-4.5">
        {msg && (
          <div className="rounded-lg bg-good-bg px-4 py-3 text-[13px] font-medium text-[#0a6b0a]">
            {msg === "approved" && "Vendor approved."}
            {msg === "rejected" && "Vendor rejected."}
            {msg === "on_hold" && "Vendor put on hold."}
            {msg === "saved" && "Changes saved."}
          </div>
        )}
        {error === "reason_required" && (
          <div className="rounded-lg bg-crit-bg px-4 py-3 text-[13px] font-medium text-[#a12525]">
            A rejection reason is required.
          </div>
        )}

        <div className="grid grid-cols-3 gap-4.5">
          <div className="col-span-2 space-y-4.5">
            <Card>
              <CardHeader title="Company & Contact" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-[13px]">
                <Field label="Company name" value={vendor.company_name} />
                <Field label="Vendor type" value={titleCase(vendor.vendor_type)} />
                <Field label="Business type" value={vendor.business_type ?? "—"} />
                <Field label="Contact name" value={profile?.full_name ?? "—"} />
                <Field label="Email" value={profile?.email ?? "—"} />
                <Field label="Phone" value={profile?.phone ?? "—"} />
                <Field label="GSTIN" value={vendor.gstin ?? "—"} />
                <Field label="PAN" value={vendor.pan ?? "—"} />
                <Field label="Registered address" value={vendor.registered_address ?? "—"} />
                <Field label="Registered pincode" value={vendor.registered_pincode ?? "—"} />
                <Field label="Warehouse pincode" value={vendor.warehouse_pincode ?? "—"} />
                <Field label="Typical lead time" value={vendor.typical_lead_time ?? "—"} />
                <Field label="Min order policy" value={vendor.min_order_policy ?? "—"} />
                <Field
                  label="Rating"
                  value={vendor.rating != null ? vendor.rating.toFixed(1) : "—"}
                />
                <Field label="Joined" value={formatDate(vendor.created_at)} />
              </div>
            </Card>

            <Card>
              <CardHeader title={isFabrication ? "Capabilities" : "Materials Handled"} />
              <div className="p-5">
                {skillTags?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {skillTags.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-grid px-3 py-1 text-[12px] font-semibold text-ink-2"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted">Not provided.</p>
                )}
                {isFabrication && vendor.materials_machined?.length ? (
                  <>
                    <div className="mb-2 mt-4 text-[12px] font-semibold uppercase tracking-wide text-muted">
                      Materials machined
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {vendor.materials_machined.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-grid px-3 py-1 text-[12px] font-semibold text-ink-2"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </Card>

            <Card>
              <CardHeader title="Bank Details & Documents" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-[13px]">
                <Field label="Bank account number" value={vendor.bank_account_number ?? "—"} />
                <Field label="IFSC code" value={vendor.ifsc_code ?? "—"} />
                <DocField label="Certifications" url={vendor.certifications_url} />
                <DocField label="Cancelled cheque" url={vendor.cancelled_cheque_url} />
              </div>
            </Card>
          </div>

          <div className="space-y-4.5">
            <Card>
              <CardHeader title="KYC Decision" />
              <div className="space-y-3 p-5">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="text-ink-2">Current status:</span>
                  <Badge tone={kycTone(vendor.kyc_status)}>{titleCase(vendor.kyc_status)}</Badge>
                </div>
                {vendor.kyc_rejection_reason && (
                  <div className="rounded-lg bg-crit-bg px-3.5 py-3 text-[12.5px] text-[#a12525]">
                    <b>Last rejection reason:</b> {vendor.kyc_rejection_reason}
                  </div>
                )}

                <form action={approveVendorAction}>
                  <input type="hidden" name="vendorId" value={vendor.id} />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={vendor.kyc_status === "approved"}
                  >
                    Approve
                  </Button>
                </form>

                <form action={holdVendorAction}>
                  <input type="hidden" name="vendorId" value={vendor.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full"
                    disabled={vendor.kyc_status === "on_hold"}
                  >
                    Put On Hold
                  </Button>
                </form>

                <form action={rejectVendorAction} className="space-y-2 border-t border-grid pt-3">
                  <input type="hidden" name="vendorId" value={vendor.id} />
                  <label className="block text-[12px] font-semibold text-ink-2">
                    Rejection reason
                  </label>
                  <textarea
                    name="reason"
                    rows={3}
                    placeholder="Explain why this vendor's KYC is being rejected…"
                    className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13px] outline-none focus:border-brand"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full border-crit text-crit hover:bg-crit-bg"
                  >
                    Reject
                  </Button>
                </form>
              </div>
            </Card>

            <Card>
              <CardHeader title="Commission & Internal Notes" />
              <form action={updateVendorMetaAction} className="space-y-3 p-5">
                <input type="hidden" name="vendorId" value={vendor.id} />
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-ink-2">
                    Commission override (%)
                  </label>
                  <input
                    name="commissionOverride"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    defaultValue={vendor.commission_override ?? ""}
                    placeholder="Platform default"
                    className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13px] outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12px] font-semibold text-ink-2">
                    Internal notes
                  </label>
                  <textarea
                    name="internalNotes"
                    rows={4}
                    defaultValue={vendor.internal_notes ?? ""}
                    placeholder="Notes visible only to the admin team…"
                    className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13px] outline-none focus:border-brand"
                  />
                </div>
                <Button type="submit" variant="outline" className="w-full">
                  Save
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="font-medium text-ink">{value}</div>
    </div>
  );
}

function DocField({ label, url }: { label: string; url: string | null }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-brand">
          View document &rarr;
        </a>
      ) : (
        <span className="text-ink-2">Not uploaded</span>
      )}
    </div>
  );
}
