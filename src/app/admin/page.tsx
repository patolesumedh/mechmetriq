import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Th, Td, EmptyRow } from "./_components/table";
import {
  formatDate,
  formatINR,
  kycTone,
  orderStatusTone,
  rfqStatusTone,
  orderTypeTone,
  titleCase,
} from "./_lib/format";

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [
    { count: totalUsers },
    { count: totalVendors },
    { count: pendingKycCount },
    { data: orderTotals },
    { count: openDisputes },
    { count: activeListings },
    { count: pendingQuotes },
    { count: needsPricing },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("vendor_profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("vendor_profiles")
      .select("*", { count: "exact", head: true })
      .eq("kyc_status", "pending"),
    supabase.from("orders").select("total_amount"),
    supabase.from("disputes").select("*", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("listings").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("rfqs").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("rfqs")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .eq("price_status", "none"),
  ]);

  const gmv = (orderTotals ?? []).reduce(
    (sum, row) => sum + Number(row.total_amount ?? 0),
    0
  );

  const { data: pendingVendors } = await supabase
    .from("vendor_profiles")
    .select("id, company_name, vendor_type, kyc_status, created_at")
    .eq("kyc_status", "pending")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: recentOrders } = await supabase
    .from("orders")
    .select(
      "id, order_number, order_type, status, total_amount, created_at, buyer_id, vendor_id"
    )
    .order("created_at", { ascending: false })
    .limit(5);

  // Pending first (they need admin action), then everything else, newest first.
  const [{ data: pendingRfqs }, { data: otherRfqs }] = await Promise.all([
    supabase
      .from("rfqs")
      .select("id, buyer_id, process_id, quantity, status, price_status, estimated_total, confirmed_total, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("rfqs")
      .select("id, buyer_id, process_id, quantity, status, price_status, estimated_total, confirmed_total, created_at")
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const recentRfqs = [...(pendingRfqs ?? []), ...(otherRfqs ?? [])].slice(0, 5);
  const processIds = [...new Set(recentRfqs.map((r) => r.process_id).filter((v): v is string => !!v))];
  const { data: processes } = processIds.length
    ? await supabase.from("master_items").select("id, name").in("id", processIds)
    : { data: [] as { id: string; name: string }[] };
  const processNameById = new Map((processes ?? []).map((p) => [p.id, p.name]));

  const buyerIds = [
    ...new Set([...(recentOrders ?? []).map((o) => o.buyer_id), ...recentRfqs.map((r) => r.buyer_id)]),
  ];
  const vendorIds = [...new Set((recentOrders ?? []).map((o) => o.vendor_id).filter((v): v is string => Boolean(v)))];

  let buyerProfiles: { id: string; full_name: string }[] = [];
  if (buyerIds.length) {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", buyerIds);
    buyerProfiles = data ?? [];
  }

  let vendorProfiles: { id: string; company_name: string }[] = [];
  if (vendorIds.length) {
    const { data } = await supabase
      .from("vendor_profiles")
      .select("id, company_name")
      .in("id", vendorIds);
    vendorProfiles = data ?? [];
  }

  const buyerNameById = new Map(buyerProfiles.map((p) => [p.id, p.full_name]));
  const vendorNameById = new Map(vendorProfiles.map((v) => [v.id, v.company_name]));

  return (
    <div>
      <Topbar title="Overview" />
      <div className="mt-6 grid grid-cols-4 gap-3.5 xl:grid-cols-7">
        <Link href="/admin/quotes" className="block rounded-[10px] ring-brand transition hover:ring-2">
          <StatCard
            label="Pending Quotes"
            value={String(pendingQuotes ?? 0)}
            delta={
              needsPricing
                ? `${needsPricing} need${needsPricing === 1 ? "s" : ""} pricing`
                : pendingQuotes
                  ? "Estimates to review"
                  : undefined
            }
            deltaTone="warn"
          />
        </Link>
        <StatCard label="Total Users" value={String(totalUsers ?? 0)} />
        <StatCard label="Total Vendors" value={String(totalVendors ?? 0)} />
        <StatCard
          label="Pending Vendor KYC"
          value={String(pendingKycCount ?? 0)}
          delta={pendingKycCount ? "Needs review" : undefined}
          deltaTone="warn"
        />
        <StatCard label="GMV (All Orders)" value={formatINR(gmv)} />
        <StatCard
          label="Open Disputes"
          value={String(openDisputes ?? 0)}
          delta={openDisputes ? "Needs attention" : undefined}
          deltaTone="warn"
        />
        <StatCard label="Active Listings" value={String(activeListings ?? 0)} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4.5">
        <Card>
          <CardHeader title="Quotes & RFQs" action={{ label: "View all", href: "/admin/quotes" }} />
          <Table>
            <thead>
              <tr>
                <Th>Buyer</Th>
                <Th>Process</Th>
                <Th>Qty</Th>
                <Th>Price</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {recentRfqs.length === 0 && <EmptyRow colSpan={5}>No RFQs submitted yet.</EmptyRow>}
              {recentRfqs.map((r) => (
                <tr key={r.id}>
                  <Td strong>
                    <Link href={`/admin/quotes/${r.id}`} className="hover:text-brand">
                      {buyerNameById.get(r.buyer_id) ?? "—"}
                    </Link>
                    <div className="text-[11.5px] font-normal text-muted">{formatDate(r.created_at)}</div>
                  </Td>
                  <Td>{r.process_id ? processNameById.get(r.process_id) ?? "—" : "—"}</Td>
                  <Td>{r.quantity}</Td>
                  <Td>
                    {r.price_status === "confirmed" ? (
                      formatINR(r.confirmed_total)
                    ) : r.price_status === "estimated" ? (
                      <span>
                        {formatINR(r.estimated_total)}
                        <span className="block text-[11.5px] font-semibold text-[#a8461a]">Estimate · review</span>
                      </span>
                    ) : (
                      <Link href={`/admin/quotes/${r.id}`} className="text-[12px] font-semibold text-[#a8461a]">
                        Needs pricing →
                      </Link>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={rfqStatusTone(r.status)}>{titleCase(r.status)}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>


        <Card>
          <CardHeader title="Recent Orders" action={{ label: "View all", href: "/admin/orders" }} />
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Buyer</Th>
                <Th>Vendor</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {(recentOrders ?? []).length === 0 && (
                <EmptyRow colSpan={5}>No orders placed yet.</EmptyRow>
              )}
              {(recentOrders ?? []).map((o) => (
                <tr key={o.id}>
                  <Td strong>
                    <Link href={`/admin/orders/${o.id}`} className="flex items-center gap-2 hover:text-brand">
                      {o.order_number}
                      <Badge tone={orderTypeTone(o.order_type)}>
                        {o.order_type === "custom_part" ? "Custom" : "Raw Material"}
                      </Badge>
                    </Link>
                  </Td>
                  <Td>{buyerNameById.get(o.buyer_id) ?? "—"}</Td>
                  <Td>{(o.vendor_id ? vendorNameById.get(o.vendor_id) : "Unassigned") ?? "—"}</Td>
                  <Td strong>{formatINR(o.total_amount)}</Td>
                  <Td>
                    <Badge tone={orderStatusTone(o.status)}>{titleCase(o.status)}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      <div className="mt-4.5">
        <Card>
          <CardHeader title="Pending Vendor KYC" action={{ label: "View all", href: "/admin/vendors?status=pending" }} />
          <Table>
            <thead>
              <tr>
                <Th>Vendor</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Submitted</Th>
              </tr>
            </thead>
            <tbody>
              {(pendingVendors ?? []).length === 0 && (
                <EmptyRow colSpan={4}>No vendors pending KYC review.</EmptyRow>
              )}
              {(pendingVendors ?? []).map((v) => (
                <tr key={v.id}>
                  <Td strong>
                    <Link href={`/admin/vendors/${v.id}`} className="hover:text-brand">
                      {v.company_name}
                    </Link>
                  </Td>
                  <Td>{titleCase(v.vendor_type)}</Td>
                  <Td>
                    <Badge tone={kycTone(v.kyc_status)}>{titleCase(v.kyc_status)}</Badge>
                  </Td>
                  <Td>{formatDate(v.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
