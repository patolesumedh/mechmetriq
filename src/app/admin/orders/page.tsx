import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Th, Td, EmptyRow } from "../_components/table";
import { FilterTabs } from "../_components/FilterTabs";
import { formatDate, formatINR, orderStatusTone, orderTypeTone, titleCase } from "../_lib/format";
import type { Database } from "@/lib/types/database";

type OrderStatus = Database["public"]["Enums"]["order_status"];

const ORDER_STATUSES: OrderStatus[] = [
  "draft",
  "quoted",
  "accepted_paid",
  "in_production",
  "qc_ready",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  "disputed",
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const needsVendor = status === "needs_vendor";
  const statusFilter = ORDER_STATUSES.includes(status as OrderStatus)
    ? (status as OrderStatus)
    : undefined;

  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select("id, order_number, order_type, status, total_amount, created_at, buyer_id, vendor_id")
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }
  if (needsVendor) {
    query = query.eq("order_type", "custom_part").eq("status", "accepted_paid").is("vendor_id", null);
  }

  const { data: orders } = await query;

  const buyerIds = [...new Set((orders ?? []).map((o) => o.buyer_id))];
  const vendorIds = [...new Set((orders ?? []).map((o) => o.vendor_id).filter((v): v is string => Boolean(v)))];

  let buyers: { id: string; full_name: string }[] = [];
  if (buyerIds.length) {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", buyerIds);
    buyers = data ?? [];
  }

  let vendors: { id: string; company_name: string }[] = [];
  if (vendorIds.length) {
    const { data } = await supabase
      .from("vendor_profiles")
      .select("id, company_name")
      .in("id", vendorIds);
    vendors = data ?? [];
  }

  const buyerNameById = new Map(buyers.map((b) => [b.id, b.full_name]));
  const vendorNameById = new Map(vendors.map((v) => [v.id, v.company_name]));

  return (
    <div>
      <Topbar title="Orders" pill={{ label: `${orders?.length ?? 0} total` }} />

      <div className="mt-6">
        <FilterTabs
          basePath="/admin/orders"
          paramName="status"
          active={needsVendor ? "needs_vendor" : statusFilter}
          tabs={[
            { label: "All", value: undefined },
            { label: "Needs vendor", value: "needs_vendor" },
            ...ORDER_STATUSES.map((s) => ({ label: titleCase(s), value: s })),
          ]}
        />

        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Order #</Th>
                <Th>Type</Th>
                <Th>Buyer</Th>
                <Th>Vendor</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
                <Th>Placed</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {(orders ?? []).length === 0 && (
                <EmptyRow colSpan={8}>No orders match this filter.</EmptyRow>
              )}
              {(orders ?? []).map((o) => (
                <tr key={o.id}>
                  <Td strong>{o.order_number}</Td>
                  <Td>
                    <Badge tone={orderTypeTone(o.order_type)}>
                      {o.order_type === "custom_part" ? "Custom Part" : "Raw Material"}
                    </Badge>
                  </Td>
                  <Td>{buyerNameById.get(o.buyer_id) ?? "—"}</Td>
                  <Td>
                    {o.vendor_id ? (
                      vendorNameById.get(o.vendor_id) ?? "—"
                    ) : o.order_type === "custom_part" && o.status === "accepted_paid" ? (
                      <Badge tone="new">Needs vendor</Badge>
                    ) : (
                      "Unassigned"
                    )}
                  </Td>
                  <Td strong>{formatINR(o.total_amount)}</Td>
                  <Td>
                    <Badge tone={orderStatusTone(o.status)}>{titleCase(o.status)}</Badge>
                  </Td>
                  <Td>{formatDate(o.created_at)}</Td>
                  <Td>
                    <Link href={`/admin/orders/${o.id}`} className="font-semibold text-brand">
                      {!o.vendor_id && o.order_type === "custom_part" && o.status === "accepted_paid"
                        ? "Assign →"
                        : "View →"}
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
