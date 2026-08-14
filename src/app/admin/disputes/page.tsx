import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Th, Td, EmptyRow } from "../_components/table";
import { FilterTabs } from "../_components/FilterTabs";
import { formatDateTime, disputeTone, titleCase } from "../_lib/format";
import { resolveDisputeAction } from "./actions";
import type { Database } from "@/lib/types/database";

type DisputeStatus = Database["public"]["Enums"]["dispute_status"];
const DISPUTE_STATUSES: DisputeStatus[] = ["open", "reviewing", "resolved"];

export default async function AdminDisputesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; msg?: string; error?: string }>;
}) {
  const { status, msg, error } = await searchParams;
  const statusFilter = DISPUTE_STATUSES.includes(status as DisputeStatus)
    ? (status as DisputeStatus)
    : undefined;

  const supabase = await createClient();

  let query = supabase
    .from("disputes")
    .select("id, order_id, issue, status, raised_by, resolution, created_at")
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: disputes } = await query;

  const orderIds = [...new Set((disputes ?? []).map((d) => d.order_id))];
  const raisedByIds = [...new Set((disputes ?? []).map((d) => d.raised_by))];

  let orders: { id: string; order_number: string }[] = [];
  if (orderIds.length) {
    const { data } = await supabase.from("orders").select("id, order_number").in("id", orderIds);
    orders = data ?? [];
  }

  let raisers: { id: string; full_name: string }[] = [];
  if (raisedByIds.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", raisedByIds);
    raisers = data ?? [];
  }

  const orderNumberById = new Map(orders.map((o) => [o.id, o.order_number]));
  const nameById = new Map(raisers.map((p) => [p.id, p.full_name]));

  return (
    <div>
      <Topbar title="Disputes" pill={{ label: `${disputes?.length ?? 0} total` }} />

      <div className="mt-6">
        {msg === "resolved" && (
          <div className="mb-4 rounded-lg bg-good-bg px-4 py-3 text-[13px] font-medium text-[#0a6b0a]">
            Dispute marked as resolved.
          </div>
        )}
        {error === "resolution_required" && (
          <div className="mb-4 rounded-lg bg-crit-bg px-4 py-3 text-[13px] font-medium text-[#a12525]">
            A resolution note is required to resolve a dispute.
          </div>
        )}

        <FilterTabs
          basePath="/admin/disputes"
          paramName="status"
          active={statusFilter}
          tabs={[
            { label: "All", value: undefined },
            { label: "Open", value: "open" },
            { label: "Reviewing", value: "reviewing" },
            { label: "Resolved", value: "resolved" },
          ]}
        />

        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Issue</Th>
                <Th>Raised by</Th>
                <Th>Status</Th>
                <Th>Raised on</Th>
                <Th>Resolution</Th>
              </tr>
            </thead>
            <tbody>
              {(disputes ?? []).length === 0 && (
                <EmptyRow colSpan={6}>No disputes match this filter.</EmptyRow>
              )}
              {(disputes ?? []).map((d) => (
                <tr key={d.id}>
                  <Td strong>
                    <Link href={`/admin/orders/${d.order_id}`} className="hover:text-brand">
                      {orderNumberById.get(d.order_id) ?? d.order_id.slice(0, 8)}
                    </Link>
                  </Td>
                  <Td>{d.issue}</Td>
                  <Td>{nameById.get(d.raised_by) ?? "—"}</Td>
                  <Td>
                    <Badge tone={disputeTone(d.status)}>{titleCase(d.status)}</Badge>
                  </Td>
                  <Td>{formatDateTime(d.created_at)}</Td>
                  <Td className="min-w-[240px]">
                    {d.status === "resolved" ? (
                      <span className="text-ink-2">{d.resolution ?? "—"}</span>
                    ) : (
                      <form action={resolveDisputeAction} className="flex flex-col gap-2">
                        <input type="hidden" name="disputeId" value={d.id} />
                        <textarea
                          name="resolution"
                          rows={2}
                          required
                          placeholder="Resolution notes…"
                          className="w-full rounded-lg border border-grid px-3 py-2 text-[12.5px] outline-none focus:border-brand"
                        />
                        <button
                          type="submit"
                          className="self-start rounded-lg bg-brand-light px-3 py-1.5 text-[12px] font-bold text-brand-dark"
                        >
                          Resolve
                        </button>
                      </form>
                    )}
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
