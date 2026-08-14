import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Th, Td, EmptyRow } from "../_components/table";
import { FilterTabs } from "../_components/FilterTabs";
import { formatDate, kycTone, titleCase, vendorTypeTone } from "../_lib/format";
import type { Database } from "@/lib/types/database";

type KycStatus = Database["public"]["Enums"]["kyc_status"];

const KYC_STATUSES: KycStatus[] = ["draft", "pending", "approved", "rejected", "on_hold"];

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

  if (statusFilter) {
    query = query.eq("kyc_status", statusFilter);
  }

  const { data: vendors } = await query;

  const vendorIds = (vendors ?? []).map((v) => v.id);
  const { data: profiles } = vendorIds.length
    ? await supabase.from("profiles").select("id, email").in("id", vendorIds)
    : { data: [] as { id: string; email: string }[] };
  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  return (
    <div>
      <Topbar title="Vendors" pill={{ label: `${vendors?.length ?? 0} total` }} />

      <div className="mt-6">
        <FilterTabs
          basePath="/admin/vendors"
          paramName="status"
          active={statusFilter}
          tabs={[
            { label: "All", value: undefined },
            { label: "Draft", value: "draft" },
            { label: "Pending", value: "pending" },
            { label: "Approved", value: "approved" },
            { label: "Rejected", value: "rejected" },
            { label: "On Hold", value: "on_hold" },
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
                  <Td strong>{v.company_name}</Td>
                  <Td>
                    <Badge tone={vendorTypeTone(v.vendor_type)}>{titleCase(v.vendor_type)}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={kycTone(v.kyc_status)}>{titleCase(v.kyc_status)}</Badge>
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
