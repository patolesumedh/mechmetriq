import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDate } from "../../_lib/format";
import { loadKycForAdmin } from "@/lib/kyc/server";
import { loadDetailsRow } from "@/lib/kyc/details";
import { DOC_KINDS } from "@/lib/kyc/rules";
import { updateVendorMetaAction } from "./actions";
import {
  DuplicatesPanel,
  KycDecisionCard,
  ReviewHistoryCard,
  VendorTypeCard,
  type DuplicateRow,
  type ReviewRow,
} from "./ReviewPanels";
import { KYC_STATUS_LABEL, VENDOR_TYPE_LABEL } from "@/lib/kyc/status";

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

  // Decrypts PAN / bank details and creates 5-minute document links.
  // Every call is written to kyc_audit_log.
  const [kyc, details] = await Promise.all([
    loadKycForAdmin(supabase, id),
    loadDetailsRow(supabase, id),
  ]);
  const d = details;
  const k = kyc?.row;

  // Review history + possible duplicates (F5.2 / F5.4).
  const [{ data: reviewRows }, { data: flagRows }] = await Promise.all([
    supabase
      .from("vendor_kyc_reviews")
      .select("*")
      .eq("vendor_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("vendor_duplicate_flags")
      .select("id, field, vendor_id, matched_vendor_id, detected_at")
      .or(`vendor_id.eq.${id},matched_vendor_id.eq.${id}`)
      .is("resolved_at", null),
  ]);
  const otherIds = [...new Set((flagRows ?? []).map((f) => (f.vendor_id === id ? f.matched_vendor_id : f.vendor_id)))];
  const peopleIds = [
    ...new Set(
      [...(reviewRows ?? []).map((r) => r.actor_id), vendor.kyc_reviewed_by].filter((x): x is string => !!x)
    ),
  ];
  const [{ data: others }, { data: people }] = await Promise.all([
    otherIds.length
      ? supabase.from("vendor_profiles").select("id, company_name").in("id", otherIds)
      : Promise.resolve({ data: [] as { id: string; company_name: string }[] }),
    peopleIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", peopleIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const companyOf = new Map((others ?? []).map((o) => [o.id, o.company_name]));
  const reviews: ReviewRow[] = (reviewRows ?? []).map((r) => ({
    ...r,
    actor_name: r.actor_id ? (nameOf.get(r.actor_id) ?? null) : null,
  }));
  const seen = new Set<string>();
  const duplicates: DuplicateRow[] = [];
  for (const f of flagRows ?? []) {
    const other = f.vendor_id === id ? f.matched_vendor_id : f.vendor_id;
    const key = `${other}:${f.field}`;
    if (seen.has(key)) continue;
    seen.add(key);
    duplicates.push({
      id: f.id,
      field: f.field,
      other_id: other,
      other_name: companyOf.get(other) ?? "another vendor",
      detected_at: f.detected_at,
    });
  }
  const showFab = vendor.vendor_type !== "raw_material";
  const showRaw = vendor.vendor_type !== "fabrication";

  const isFabrication = vendor.vendor_type !== "raw_material";
  const skillTags = isFabrication ? vendor.capabilities : vendor.materials_handled;

  return (
    <div>
      <Topbar
        title={vendor.company_name}
        pill={{
          label: KYC_STATUS_LABEL[vendor.kyc_status],
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
            {msg === "approve" && "Vendor approved."}
            {msg === "reject" && "Application rejected. The vendor can see the reason."}
            {msg === "start_review" && "Review started. The vendor now sees \"Under review\"."}
            {msg === "request_correction" && "Correction request sent. The vendor sees your remarks on their KYC page."}
            {msg === "suspend" && "Vendor suspended. Their orders, listings and supply are blocked."}
            {msg === "reactivate" && "Vendor reactivated."}
            {msg === "type_changed" && "Vendor type updated."}
            {msg === "duplicate_resolved" && "Duplicate flag marked as checked."}
            {msg === "saved" && "Changes saved."}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-crit-bg px-4 py-3 text-[13px] font-medium text-[#a12525]">
            {error}
          </div>
        )}
        <DuplicatesPanel vendorId={vendor.id} flags={duplicates} />

        <div className="grid grid-cols-3 gap-4.5">
          <div className="col-span-2 space-y-4.5">
            <Card>
              <CardHeader title="Company & Contact" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-[13px]">
                <Field label="Company name" value={vendor.company_name} />
                <Field label="Vendor type" value={VENDOR_TYPE_LABEL[vendor.vendor_type]} />
                <Field label="Application ID" value={vendor.application_id ?? "Not submitted"} />
                <Field
                  label="Declarations accepted"
                  value={
                    vendor.declarations_accepted_at
                      ? `${formatDate(vendor.declarations_accepted_at)} (${vendor.declarations_version})`
                      : "—"
                  }
                />
                <Field label="Business type" value={vendor.business_type ?? "—"} />
                <Field label="Contact name" value={profile?.full_name ?? "—"} />
                <Field label="Email" value={profile?.email ?? "—"} />
                <Field label="Phone" value={profile?.phone ?? "—"} />
                <Field label="GSTIN" value={vendor.gstin ?? "—"} />
                <Field label="PAN" value={kyc?.pan ?? "—"} />
                <Field
                  label="Registered address"
                  value={
                    [k?.registered_address, k?.address_line2, k?.city, k?.state]
                      .filter(Boolean)
                      .join(", ") || "—"
                  }
                />
                <Field label="Trade / brand name" value={d?.trade_name ?? "—"} />
                <Field label="Year of establishment" value={d?.year_established?.toString() ?? "—"} />
                <Field label="Business email" value={d?.business_email ?? "—"} />
                <Field label="Website" value={d?.website ?? "—"} />
                <Field label="Udyam / MSME no." value={k?.udyam_number ?? "—"} />
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
                {kyc?.decryptError && (
                  <div className="col-span-2 rounded-lg bg-crit-bg px-3.5 py-3 text-[12.5px] text-[#a12525]">
                    Encrypted fields can&rsquo;t be read: KYC_ENCRYPTION_KEY is missing or wrong on
                    the server.
                  </div>
                )}
                <Field label="Account holder name" value={kyc?.row.account_holder_name ?? "—"} />
                <Field label="Bank account number" value={kyc?.account ?? "—"} />
                <Field label="IFSC code" value={kyc?.ifsc ?? "—"} />
                <DocField label="Cancelled cheque / passbook" url={kyc?.chequeUrl ?? null} />
                <div className="col-span-2">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Certifications
                  </div>
                  {kyc?.certificationUrls.length ? (
                    <ul className="space-y-1">
                      {kyc.certificationUrls.map((c) => (
                        <li key={c.name}>
                          {c.url ? (
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-brand"
                            >
                              {c.name} &rarr;
                            </a>
                          ) : (
                            c.name
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-ink-2">Not uploaded</span>
                  )}
                </div>
                <Field
                  label="Privacy consent"
                  value={
                    kyc?.row.consent_at
                      ? `${formatDate(kyc.row.consent_at)} (${kyc.row.consent_version})`
                      : "Not given"
                  }
                />
                {kyc?.row.deletion_requested_at && (
                  <Field
                    label="Data deletion requested"
                    value={formatDate(kyc.row.deletion_requested_at)}
                  />
                )}
                {DOC_KINDS.filter((dk) => kyc?.documentUrls[dk.key]?.length).map((dk) => (
                  <div key={dk.key} className="col-span-2">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {dk.label}
                    </div>
                    <ul className="space-y-1">
                      {kyc!.documentUrls[dk.key].map((f, i) => (
                        <li key={i}>
                          {f.url ? (
                            <a href={f.url} target="_blank" rel="noreferrer noopener" className="font-semibold text-brand">
                              {f.name} &rarr;
                            </a>
                          ) : (
                            f.name
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="col-span-2 text-[11.5px] text-muted">
                  Document links expire after 5 minutes. Views of this page are logged.
                </p>
              </div>
            </Card>

            <Card>
              <CardHeader title="Primary Contact" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-[13px]">
                <Field label="Name" value={k?.contact_name ?? "—"} />
                <Field label="Designation" value={k?.contact_designation ?? "—"} />
                <Field label="Mobile" value={k?.contact_mobile ?? "—"} />
                <Field label="Email" value={k?.contact_email ?? "—"} />
              </div>
            </Card>

            <Card>
              <CardHeader title="Facility & Operations" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-[13px]">
                <Field label="Locations" value={d?.facility_locations ?? "—"} />
                <Field label="Facilities" value={d?.facility_count?.toString() ?? "—"} />
                <Field
                  label="Area"
                  value={d?.facility_area_sqft != null ? `${d.facility_area_sqft.toLocaleString("en-IN")} sq ft` : "—"}
                />
                <Field label="Employees" value={d?.employee_count?.toLocaleString("en-IN") ?? "—"} />
                <Field label="Working days / hours" value={d?.working_hours ?? "—"} />
                <Field label="Capacity" value={d?.production_capacity ?? "—"} />
                <Field label="Serviceable geography" value={d?.serviceable_geography ?? "—"} />
              </div>
            </Card>

            <Card>
              <CardHeader
                title={showFab && showRaw ? "Capability & Supply" : showFab ? "Manufacturing Capability" : "Supply Details"}
              />
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-[13px]">
                {showFab && (
                  <>
                    <Field label="Machines" value={d?.machines ?? "—"} />
                    <Field label="Max job size" value={d?.max_job_size ?? "—"} />
                    <Field label="Best tolerance" value={d?.tolerance_capability ?? "—"} />
                    <Field label="Industries" value={d?.industries?.join(", ") || "—"} />
                    <Field label="Inspection" value={d?.inspection_capability?.join(", ") || "—"} />
                  </>
                )}
                {showRaw && (
                  <>
                    <Field label="Brands / mills" value={d?.brands ?? "—"} />
                    <Field label="Supply capacity" value={d?.supply_capacity ?? "—"} />
                    <Field label="Stock / warehouse" value={d?.stock_locations ?? "—"} />
                    <Field label="Delivery locations" value={d?.delivery_locations ?? "—"} />
                  </>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-4.5">
            <KycDecisionCard
              vendor={vendor}
              reviewerName={vendor.kyc_reviewed_by ? (nameOf.get(vendor.kyc_reviewed_by) ?? null) : null}
            />
            <ReviewHistoryCard reviews={reviews} />
            <VendorTypeCard vendor={vendor} />

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
      <div className="whitespace-pre-line break-words font-medium text-ink">{value}</div>
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
        <a href={url} target="_blank" rel="noreferrer noopener" className="font-semibold text-brand">
          View document &rarr;
        </a>
      ) : (
        <span className="text-ink-2">Not uploaded</span>
      )}
    </div>
  );
}
