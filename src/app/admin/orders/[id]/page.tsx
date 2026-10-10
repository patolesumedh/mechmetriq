import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Th, Td, EmptyRow } from "../../_components/table";
import {
  formatDateTime,
  formatINR,
  orderStatusTone,
  orderTypeTone,
  paymentStatusTone,
  titleCase,
} from "../../_lib/format";
import { RmLinesTable, RmTotals } from "@/components/rawMaterials/RmOrderParts";
import { rmStatusLabel } from "@/lib/rawMaterials/format";
import { RmApprovalCard } from "./RmApprovalCard";
import { AssignVendorCard } from "./AssignVendorCard";
import { CompleteOrderCard } from "./CompleteOrderCard";

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rm_error?: string; rm_done?: string; cp_error?: string; cp_done?: string }>;
}) {
  const { id } = await params;
  const { rm_error: rmError, rm_done: rmDone, cp_error: cpError, cp_done: cpDone } = await searchParams;
  const supabase = await createClient();

  const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();
  if (!order) notFound();

  const [
    { data: buyer },
    { data: vendor },
    { data: address },
    { data: items },
    { data: payments },
    { data: disputes },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, email, phone").eq("id", order.buyer_id).single(),
    order.vendor_id
      ? supabase.from("vendor_profiles").select("company_name, gstin").eq("id", order.vendor_id).single()
      : Promise.resolve({ data: null }),
    order.delivery_address_id
      ? supabase
          .from("addresses")
          .select("label, full_address, pincode")
          .eq("id", order.delivery_address_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase.from("order_items").select("*").eq("order_id", id).order("rm_line_no"),
    supabase.from("payments").select("*").eq("order_id", id).order("created_at", { ascending: false }),
    supabase.from("disputes").select("id, status").eq("order_id", id),
  ]);

  const isRm = order.order_type === "raw_material";
  const needsApproval = isRm && order.status === "draft";
  const [{ data: eligible }, { data: rmVendors }] = needsApproval
    ? await Promise.all([
        supabase.rpc("rm_eligible_vendors", { p_order_id: id }),
        supabase
          .from("vendor_profiles")
          .select("id, company_name")
          .eq("vendor_type", "raw_material")
          .eq("kyc_status", "approved")
          .order("company_name"),
      ])
    : [{ data: null }, { data: null }];

  const isCustom = order.order_type === "custom_part";
  const canAssign = isCustom && order.status === "accepted_paid";
  const canComplete =
    isCustom && ["in_production", "qc_ready", "shipped", "delivered"].includes(order.status);
  const [{ data: assignment }, { data: fabVendors }, { data: rfq }] = isCustom
    ? await Promise.all([
        supabase
          .from("order_vendor_assignments")
          .select("vendor_id, vendor_payout, commission_pct, note, assigned_at")
          .eq("order_id", id)
          .maybeSingle(),
        canAssign
          ? supabase.rpc("cp_eligible_vendors", { p_order_id: id })
          : Promise.resolve({ data: null }),
        order.source_rfq_id
          ? supabase
              .from("rfqs")
              .select("id, process:master_items!rfqs_process_id_fkey(name)")
              .eq("id", order.source_rfq_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])
    : [{ data: null }, { data: null }, { data: null }];
  const processLabel =
    (rfq as unknown as { process: { name: string } | null } | null)?.process?.name ?? null;

  return (
    <div>
      <Topbar
        title={order.order_number}
        pill={{ label: titleCase(order.status), tone: order.status === "disputed" ? "orange" : "brand" }}
        right={
          <Link href="/admin/orders" className="text-[13px] font-semibold text-brand">
            &larr; Back to orders
          </Link>
        }
      />

      <div className="mt-6 grid grid-cols-3 gap-4.5">
        <div className="col-span-2 space-y-4.5">
          <Card>
            <CardHeader title="Order Summary" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-[13px]">
              <Field label="Order type">
                <Badge tone={orderTypeTone(order.order_type)}>
                  {order.order_type === "custom_part" ? "Custom Part" : "Raw Material"}
                </Badge>
              </Field>
              <Field label="Status">
                <Badge tone={orderStatusTone(order.status)}>{titleCase(order.status)}</Badge>
              </Field>
              <Field label="Placed on">{formatDateTime(order.created_at)}</Field>
              <Field label="Last updated">{formatDateTime(order.updated_at)}</Field>
              <Field label="Tracking number">{order.tracking_number ?? "—"}</Field>
              <Field label="Billing GSTIN">{order.billing_gstin ?? "—"}</Field>
              <Field label="Invoice">
                {order.invoice_url ? (
                  <a
                    href={order.invoice_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-brand"
                  >
                    View invoice &rarr;
                  </a>
                ) : (
                  "—"
                )}
              </Field>
            </div>
          </Card>

          {isRm ? (
            <Card>
              <CardHeader title={`Line Items · ${rmStatusLabel(order.status)}`} />
              <RmLinesTable items={items ?? []} />
            </Card>
          ) : (
          <Card>
            <CardHeader title="Line Items" />
            <Table>
              <thead>
                <tr>
                  <Th>Description</Th>
                  <Th>Qty</Th>
                  <Th>Unit price</Th>
                  <Th>Line total</Th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).length === 0 && <EmptyRow colSpan={4}>No line items recorded.</EmptyRow>}
                {(items ?? []).map((item) => (
                  <tr key={item.id}>
                    <Td strong>{item.description}</Td>
                    <Td>{item.quantity}</Td>
                    <Td>{formatINR(item.unit_price)}</Td>
                    <Td strong>{formatINR(item.line_total)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
          )}

          <Card>
            <CardHeader title="Payments" />
            <Table>
              <thead>
                <tr>
                  <Th>Method</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Gateway ref</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {(payments ?? []).length === 0 && (
                  <EmptyRow colSpan={5}>No payments recorded.</EmptyRow>
                )}
                {(payments ?? []).map((p) => (
                  <tr key={p.id}>
                    <Td strong>{titleCase(p.method)}</Td>
                    <Td>{formatINR(p.amount)}</Td>
                    <Td>
                      <Badge tone={paymentStatusTone(p.status)}>{titleCase(p.status)}</Badge>
                    </Td>
                    <Td>{p.gateway_ref ?? "—"}</Td>
                    <Td>{formatDateTime(p.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>

        <div className="space-y-4.5">
          {canAssign && (
            <AssignVendorCard
              orderId={order.id}
              subtotal={Number(order.subtotal)}
              vendors={fabVendors ?? []}
              current={
                assignment
                  ? {
                      vendor_id: assignment.vendor_id,
                      vendor_payout: Number(assignment.vendor_payout),
                      note: assignment.note,
                    }
                  : null
              }
              processLabel={processLabel}
              error={cpError}
              done={cpDone}
            />
          )}
          {canComplete && (
            <CompleteOrderCard
              orderId={order.id}
              dispatched={order.status === "shipped" || order.status === "delivered"}
            />
          )}
          {isCustom && order.status === "completed" && (
            <Card className="border-[#bfe3bf] bg-good-bg px-5 py-3.5 text-[13px] text-[#0a6b0a]">
              <div className="font-bold">Completed {formatDateTime(order.completed_at)}</div>
              <div>
                {order.completed_by_role === "admin" ? "Closed by an admin" : "Buyer confirmed receipt"}
                {order.completion_note ? ` — “${order.completion_note}”` : ""}
              </div>
            </Card>
          )}
          {isCustom && !canAssign && cpDone && (
            <Card className="border-[#bfe3bf] bg-good-bg px-5 py-3 text-[13px] text-[#0a6b0a]">Vendor {cpDone}.</Card>
          )}
          {needsApproval && (
            <RmApprovalCard
              orderId={order.id}
              eligible={eligible ?? []}
              allVendors={rmVendors ?? []}
              error={rmError}
              done={rmDone}
            />
          )}
          {isRm && !needsApproval && rmDone && (
            <Card className="border-[#bfe3bf] bg-good-bg px-5 py-3 text-[13px] text-[#0a6b0a]">Order {rmDone}.</Card>
          )}
          {isRm ? (
            <Card>
              <CardHeader title="Totals" />
              <div className="p-5">
                <RmTotals order={order} />
                {order.rm_admin_note && (
                  <p className="mt-3 text-[12.5px] text-ink-2">Note: {order.rm_admin_note}</p>
                )}
              </div>
            </Card>
          ) : (
          <Card>
            <CardHeader title="Totals" />
            <div className="space-y-2.5 p-5 text-[13px]">
              <Row label="Subtotal" value={formatINR(order.subtotal)} />
              <Row label="GST" value={formatINR(order.gst_amount)} />
              <Row label="Shipping" value={formatINR(order.shipping_amount)} />
              <div className="mt-2 flex items-center justify-between border-t border-grid pt-2.5 text-[14px] font-bold">
                <span>Total</span>
                <span>{formatINR(order.total_amount)}</span>
              </div>
            </div>
          </Card>
          )}

          <Card>
            <CardHeader title="Buyer" />
            <div className="space-y-2 p-5 text-[13px]">
              <Field label="Name">{buyer?.full_name ?? "—"}</Field>
              <Field label="Email">{buyer?.email ?? "—"}</Field>
              <Field label="Phone">{buyer?.phone ?? "—"}</Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Vendor" />
            <div className="space-y-2 p-5 text-[13px]">
              <Field label="Company">{vendor?.company_name ?? "—"}</Field>
              <Field label="GSTIN">{vendor?.gstin ?? "—"}</Field>
              {assignment && (
                <>
                  <Field label="Vendor payout">
                    {formatINR(assignment.vendor_payout)}
                    {assignment.commission_pct != null && (
                      <span className="ml-1.5 text-[12px] font-normal text-muted">
                        ({assignment.commission_pct}% platform margin)
                      </span>
                    )}
                  </Field>
                  <Field label="Assigned">{formatDateTime(assignment.assigned_at)}</Field>
                  {assignment.note && <Field label="Note to vendor">{assignment.note}</Field>}
                </>
              )}
              {order.vendor_id ? (
                <Link
                  href={`/admin/vendors/${order.vendor_id}`}
                  className="text-[12.5px] font-semibold text-brand"
                >
                  View vendor profile &rarr;
                </Link>
              ) : (
                <p className="text-[12.5px] text-muted">
                  {isCustom ? "Not assigned yet — use “Route to machining vendor” above." : "Assigned on approval."}
                </p>
              )}
            </div>
          </Card>

          {address && (
            <Card>
              <CardHeader title="Delivery Address" />
              <div className="space-y-1 p-5 text-[13px] text-ink-2">
                <div className="font-semibold text-ink">{address.label}</div>
                <div>{address.full_address}</div>
                <div>PIN: {address.pincode}</div>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Disputes" />
            <div className="p-5 text-[13px]">
              {(disputes ?? []).length === 0 ? (
                <p className="text-muted">No disputes filed on this order.</p>
              ) : (
                <ul className="space-y-2">
                  {(disputes ?? []).map((d) => (
                    <li key={d.id} className="flex items-center justify-between">
                      <span className="text-ink-2">Dispute raised</span>
                      <Link href="/admin/disputes" className="font-semibold text-brand">
                        View &rarr;
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="font-medium text-ink">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-ink-2">
      <span>{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
