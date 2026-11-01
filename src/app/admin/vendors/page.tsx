import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Th, Td, EmptyRow } from "../_components/table";
import { FilterTabs } from "../_components/FilterTabs";
import { formatDate, kycTone, vendorTypeTone } from "../_lib/format";
import type { Database } from "@/lib/types/database";
import { KYC_STATUS_LABEL, VENDOR_TYPE_LABEL } from "@/lib/kyc/status";

type KycStatus = Database["public"]["Enums"]["kyc_status"];

const KYC_STATUSES: KycStatus[] = [
  "draft",
  "pending",
  "under_review",
  "correction_required",
  "approved",
  "rejected",
  "suspended",
];

export default async function AdminVendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const statusFilter = KYC_STATUSES.includes(status as KycStatus)
    ? (status as KycStatus)
    : undefined;

  const supabase = await createClient();

  let query = supabase
    .from("vendor_profiles")
    .select("id, company_name, vendor_type, kyc_status, gstin, rating, created_at")
    .order("created_at", { ascending: false });

  if (statusFilter === "suspended") {
    query = query.in("kyc_status", ["suspended", "on_hold"]);
  } else if (statusFilter) {
    query = query.eq("kyc_status", statusFilter);
  }

  const [{ data: vendors }, { data: flags }] = await Promise.all([
    query,
    supabase.from("vendor_duplicate_flags").select("vendor_id, matched_vendor_id").is("resolved_at", null),
  ]);
  const flagged = new Set((flags ?? []).flatMap((f) => [f.vendor_id, f.matched_vendor_id]));

  const vendorIds = (vendors ?? []).map((v) => v.id);
  const { data: profiles } = vendorIds.length
    ? await supabase.from("profiles").select("id, email").in("id", vendorIds)
    : { data: [] as { id: string; email: string }[] };
  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  return (
    <div>
      <Topbar
        title="Vendors"
        pill={{ label: `${vendors?.length ?? 0} total` }}
        right={
          <Link
            href="/admin/vendors/invites"
            className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-bold text-white"
          >
            Invite vendor
          </Link>
        }
      />

      <div className="mt-6">
        <FilterTabs
          basePath="/admin/vendors"
          paramName="status"
          active={statusFilter}
          tabs={[
            { label: "All", value: undefined },
            { label: "Draft", value: "draft" },
            { label: "Submitted", value: "pending" },
            { label: "Under review", value: "under_review" },
            { label: "Correction required", value: "correction_required" },
            { label: "Approved", value: "approved" },
            { label: "Rejected", value: "rejected" },
            { label: "Suspended", value: "suspended" },
          ]}
        />

        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>Type</Th>
                <Th>KYC status</Th>
                <Th>GSTIN</Th>
                <Th>Rating</Th>
                <Th>Email</Th>
                <Th>Joined</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {(vendors ?? []).length === 0 && (
                <EmptyRow colSpan={8}>No vendors match this filter.</EmptyRow>
              )}
              {(vendors ?? []).map((v) => (
                <tr key={v.id}>
                  <Td strong>
                    {v.company_name}
                    {flagged.has(v.id) && (
                      <span className="ml-2 rounded-full bg-crit-bg px-2 py-0.5 text-[10.5px] font-bold text-[#a12525]">
                        Possible duplicate
                      </span>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={vendorTypeTone(v.vendor_type)}>{VENDOR_TYPE_LABEL[v.vendor_type]}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={kycTone(v.kyc_status)}>{KYC_STATUS_LABEL[v.kyc_status]}</Badge>
                  </Td>
                  <Td>{v.gstin ?? "—"}</Td>
                  <Td>{v.rating != null ? v.rating.toFixed(1) : "—"}</Td>
                  <Td>{emailById.get(v.id) ?? "—"}</Td>
                  <Td>{formatDate(v.created_at)}</Td>
                  <Td>
                    <Link href={`/admin/vendors/${v.id}`} className="font-semibold text-brand">
                      View &rarr;
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
