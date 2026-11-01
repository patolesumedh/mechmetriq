import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { loadCompleteness } from "@/lib/kyc/completeness";
import { loadCorrections } from "@/lib/kyc/vendorPortal";
import { fileLabel, toKycView } from "@/lib/kyc/server";
import { DOC_KINDS } from "@/lib/kyc/rules";
import {
  KYC_STATUS_LABEL,
  REVIEW_SECTIONS,
  VENDOR_TYPE_LABEL,
  canEditKyc,
  canSubmitKyc,
  type Portal,
  type ReviewSection,
} from "@/lib/kyc/status";
import { SubmitForm } from "./SubmitForm";

type Row = [string, string | number | null | undefined];

function Rows({ rows }: { rows: Row[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
          <dd className="whitespace-pre-line break-words font-medium text-ink">
            {value === null || value === undefined || value === "" ? <span className="text-muted">—</span> : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Review & Submit page shared by both vendor portals (F5.1). */
export async function KycReviewPage({ portal }: { portal: Portal }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { vendor, kyc, details: d, missing } = await loadCompleteness(supabase, user.id);
  if (!vendor) redirect("/login");
  const { remarks } = await loadCorrections(supabase, vendor);
  const v = toKycView(kyc);

  const materialIds = vendor.materials_handled ?? [];
  const { data: materialRows } = materialIds.length
    ? await supabase.from("master_items").select("id, name").in("id", materialIds)
    : { data: [] as { id: string; name: string }[] };
  const materialNames = materialIds.map((id) => materialRows?.find((m) => m.id === id)?.name ?? id);

  const fab = vendor.vendor_type !== "raw_material";
  const raw = vendor.vendor_type !== "fabrication";
  const editable = canEditKyc(vendor.kyc_status);
  const submittable = canSubmitKyc(vendor.kyc_status);
  const missingBy = (s: ReviewSection) => missing.filter((m) => m.section === s);
  const onboarding = `/vendor/${portal}/onboarding`;

  const sections: Record<ReviewSection, Row[]> = {
    business: [
      ["Legal business name", vendor.company_name],
      ["Trade / brand name", d?.trade_name],
      ["Vendor type", VENDOR_TYPE_LABEL[vendor.vendor_type]],
      ["Business type", vendor.business_type],
      ["Year of establishment", d?.year_established],
      ["GSTIN", vendor.gstin],
      ["PAN", v.panMasked],
      ["Udyam / MSME no.", v.udyamNumber],
      ["Business email", d?.business_email],
      ["Website", d?.website],
      [
        "Registered address",
        [v.registeredAddress, v.addressLine2, v.city, v.state].filter(Boolean).join(", "),
      ],
      ...(fab ? ([["Registered pincode", vendor.registered_pincode]] as Row[]) : []),
      ...(raw ? ([["Warehouse pincode", vendor.warehouse_pincode]] as Row[]) : []),
    ],
    contact: [
      ["Name", v.contactName],
      ["Designation", v.contactDesignation],
      ["Mobile", v.contactMobile],
      ["Email", v.contactEmail],
    ],
    operations: [
      ["Locations", d?.facility_locations],
      ["Facilities", d?.facility_count],
      ["Area (sq ft)", d?.facility_area_sqft?.toLocaleString("en-IN")],
      ["Employees", d?.employee_count?.toLocaleString("en-IN")],
      ["Working days / hours", d?.working_hours],
      ["Capacity", d?.production_capacity],
      ["Serviceable geography", d?.serviceable_geography],
    ],
    capability: [
      ...(fab
        ? ([
            ["Processes", vendor.capabilities?.join(", ")],
            ["Materials", vendor.materials_machined?.join(", ")],
            ["Machines", d?.machines],
            ["Max job size", d?.max_job_size],
            ["Best tolerance", d?.tolerance_capability],
            ["Industries", d?.industries?.join(", ")],
            ["Inspection", d?.inspection_capability?.join(", ")],
            ["Typical lead time", vendor.typical_lead_time],
          ] as Row[])
        : []),
      ...(raw
        ? ([
            ["Materials supplied", materialNames.join(", ")],
            ["Brands / mills", d?.brands],
            ["Supply capacity", d?.supply_capacity],
            ["Stock / warehouse", d?.stock_locations],
            ["Delivery locations", d?.delivery_locations],
          ] as Row[])
        : []),
      ["Min. order policy", vendor.min_order_policy],
    ],
    bank: [
      ["Account holder", v.accountHolderName],
      ["Account number", v.bankAccountMasked],
      ["IFSC", v.ifscMasked],
      ["Cancelled cheque / passbook", v.cancelledChequePath ? fileLabel(v.cancelledChequePath) : null],
    ],
    documents: [
      ...DOC_KINDS.filter((k) => v.documents[k.key]?.length).map(
        (k) => [k.label, v.documents[k.key].map(fileLabel).join("\n")] as Row
      ),
      ["Certifications", v.certificationPaths.map(fileLabel).join("\n")],
    ],
  };

  return (
    <div>
      <Topbar
        title="Review & Submit"
        pill={{ label: KYC_STATUS_LABEL[vendor.kyc_status], tone: vendor.kyc_status === "approved" ? "brand" : "orange" }}
        right={
          <Link href={onboarding} className="text-[13px] font-semibold text-brand">
            &larr; Back to KYC form
          </Link>
        }
      />
      <div className="max-w-[760px] pt-6">
        {vendor.application_id && (
          <div className="mb-4.5 rounded-[10px] border border-grid bg-surface px-5 py-3.5 text-[13px]">
            Application <b className="font-mono">{vendor.application_id}</b>
            {vendor.submitted_at &&
              ` · last submitted ${new Date(vendor.submitted_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`}
          </div>
        )}

        {submittable && missing.length > 0 && (
          <div className="mb-4.5 rounded-[10px] border border-[#f5dfa6] bg-warn-bg p-5 text-[13px] text-[#8a5a00]">
            <b>Before you can submit, add:</b>
            <ul className="mt-2 list-disc space-y-0.5 pl-5">
              {missing.map((m) => (
                <li key={m.label}>{m.label}</li>
              ))}
            </ul>
            {vendor.vendor_type === "both" ? (
              <p className="mt-3">
                You&rsquo;re registered for both portals: fabrication details are on the{" "}
                <Link href="/vendor/fabrication/onboarding" className="font-bold underline">
                  Fabrication KYC form
                </Link>
                , warehouse and materials supplied on the{" "}
                <Link href="/vendor/raw_material/onboarding" className="font-bold underline">
                  Raw material KYC form
                </Link>
                . Everything else is shared.
              </p>
            ) : (
              <Link href={onboarding} className="mt-3 inline-block font-bold underline">
                Complete KYC form &rarr;
              </Link>
            )}
          </div>
        )}

        {REVIEW_SECTIONS.map((sec) => {
          const gaps = missingBy(sec.key);
          return (
            <section key={sec.key} className="mb-4.5 rounded-[10px] border border-grid bg-surface p-6">
              <div className="mb-3.5 flex items-center justify-between">
                <h3 className="text-[14.5px] font-semibold">{sec.label}</h3>
                {editable && (
                  <Link href={`${onboarding}#${sec.anchor}`} className="text-[12.5px] font-semibold text-brand">
                    Edit
                  </Link>
                )}
              </div>
              {remarks[sec.key] && (
                <div className="mb-3.5 rounded-lg bg-crit-bg px-3.5 py-2.5 text-[12.5px] text-[#a12525]">
                  <b>To fix:</b> {remarks[sec.key]}
                </div>
              )}
              {gaps.length > 0 && submittable && (
                <p className="mb-3 text-[12.5px] font-semibold text-[#8a5a00]">
                  Missing: {gaps.map((g) => g.label).join(", ")}
                </p>
              )}
              <Rows rows={sections[sec.key]} />
            </section>
          );
        })}

        {submittable ? (
          missing.length === 0 ? (
            <section className="mb-4.5 rounded-[10px] border border-grid bg-surface p-6">
              <h3 className="mb-3 text-[14.5px] font-semibold">Declarations</h3>
              <SubmitForm resubmit={!!vendor.application_id} />
            </section>
          ) : null
        ) : (
          <p className="text-[13px] text-muted">
            {vendor.kyc_status === "approved"
              ? "Your KYC is approved. Changes you save on the KYC form apply straight away."
              : "Your application has been submitted. You'll be able to make changes if our team asks for corrections."}
          </p>
        )}
      </div>
    </div>
  );
}
