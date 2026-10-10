import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  formatDate,
  formatINR,
  nextOrderStatus,
  orderStatusLabel,
  orderStatusTone,
} from "../../badge-utils";
import { StatusUpdateForm } from "./StatusUpdateForm";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: vendorProfile } = await supabase
    .from("vendor_profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!vendorProfile) redirect("/login");

  const { data: order } = await supabase
    .from("orders")
    .select("*, buyer:profiles!orders_buyer_id_fkey(full_name)")
    .eq("id", id)
    .single();

  if (!order || order.vendor_id !== vendorProfile.id) notFound();

  const buyerName = (order as unknown as { buyer: { full_name: string } | null }).buyer?.full_name;

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", id);

  const next = nextOrderStatus(order.status);

  // Custom parts: the vendor is paid the admin-set payout (not the buyer
  // price) and needs the RFQ spec + CAD files to make the part.
  const isCustom = order.order_type === "custom_part";
  const [{ data: assignment }, { data: rfqRow }] = isCustom
    ? await Promise.all([
        supabase
          .from("order_vendor_assignments")
          .select("vendor_payout, note, assigned_at")
          .eq("order_id", id)
          .maybeSingle(),
        order.source_rfq_id
          ? supabase
              .from("rfqs")
              .select(
                "quantity, subprocess, tolerance, surface_finish, finish_options, colour_coating, surface_roughness, threads_qty, inserts_qty, part_marking, inspection, certificates, special_instructions, cad_file_urls, confirmed_lead_days, process:master_items!rfqs_process_id_fkey(name), material:master_items!rfqs_material_id_fkey(name), grade:rm_grades(name)"
              )
              .eq("id", order.source_rfq_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])
    : [{ data: null }, { data: null }];

  const spec = rfqRow as unknown as {
    quantity: number;
    subprocess: string | null;
    tolerance: string | null;
    surface_finish: string | null;
    finish_options: string[] | null;
    colour_coating: string | null;
    surface_roughness: string | null;
    threads_qty: number | null;
    inserts_qty: number | null;
    part_marking: string[] | null;
    inspection: string | null;
    certificates: string[] | null;
    special_instructions: string | null;
    cad_file_urls: string[] | null;
    confirmed_lead_days: number | null;
    process: { name: string } | null;
    material: { name: string } | null;
    grade: { name: string } | null;
  } | null;

  let cadFileLinks: { name: string; url: string }[] = [];
  if (spec?.cad_file_urls?.length) {
    const { data: signed } = await supabase.storage
      .from("rfq-attachments")
      .createSignedUrls(spec.cad_file_urls, 60 * 60);
    cadFileLinks = (signed ?? [])
      .map((f, i) => ({
        name: (spec.cad_file_urls![i].split("/").pop() ?? `CAD file ${i + 1}`).replace(/^[0-9]{10,}-/, ""),
        url: f.signedUrl,
      }))
      .filter((f): f is { name: string; url: string } => !!f.url);
  }
  const list = (v: string[] | null | undefined) => (v && v.length ? v.join(", ") : "—");

  return (
    <div>
      <Topbar
        title={order.order_number}
        pill={{ label: orderStatusLabel(order.status), tone: "brand" }}
      />

      <div className="mt-6 grid grid-cols-[1.5fr_1fr] gap-4.5">
        <div className="space-y-4.5">
          <Card>
            <CardHeader title="Order Items" />
            {orderItems && orderItems.length > 0 ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Description
                    </th>
                    <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Qty
                    </th>
                    {!assignment && (
                      <>
                    <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Unit Price
                    </th>
                    <th className="border-b border-grid px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Line Total
                    </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((item) => (
                    <tr key={item.id}>
                      <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink last:border-b-0">
                        {item.description}
                      </td>
                      <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                        {item.quantity}
                      </td>
                      {!assignment && (
                        <>
                      <td className="border-b border-grid px-5 py-3.5 text-[13px] text-ink-2">
                        {formatINR(item.unit_price)}
                      </td>
                      <td className="border-b border-grid px-5 py-3.5 text-[13px] font-semibold text-ink">
                        {formatINR(item.line_total)}
                      </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-5 py-8 text-center text-[13px] text-muted">No line items.</div>
            )}
            {assignment ? (
              <div className="space-y-1.5 border-t border-grid px-5 py-4">
                <div className="flex justify-between text-[14px] font-bold text-ink">
                  <span>Your payout (excl. GST)</span>
                  <span>{formatINR(assignment.vendor_payout)}</span>
                </div>
                <p className="text-[12px] text-muted">Agreed job value set by MECHmetriQ when this job was assigned to you.</p>
              </div>
            ) : (
            <div className="space-y-1.5 border-t border-grid px-5 py-4">
              <div className="flex justify-between text-[13px] text-ink-2">
                <span>Subtotal</span>
                <span>{formatINR(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[13px] text-ink-2">
                <span>GST</span>
                <span>{formatINR(order.gst_amount)}</span>
              </div>
              <div className="flex justify-between text-[13px] text-ink-2">
                <span>Shipping</span>
                <span>{formatINR(order.shipping_amount)}</span>
              </div>
              <div className="flex justify-between border-t border-grid pt-1.5 text-[14px] font-bold text-ink">
                <span>Total</span>
                <span>{formatINR(order.total_amount)}</span>
              </div>
            </div>
            )}
          </Card>

          {spec && (
            <Card>
              <CardHeader title="Job Specification" />
              <div className="divide-y divide-grid">
                <SpecRow label="Process" value={[spec.process?.name, spec.subprocess].filter(Boolean).join(" · ") || "—"} />
                <SpecRow label="Material" value={spec.grade?.name ?? spec.material?.name ?? "—"} />
                <SpecRow label="Quantity" value={`${spec.quantity} pcs`} />
                <SpecRow label="Tolerance" value={spec.tolerance ?? "—"} />
                <SpecRow label="Finish" value={spec.finish_options?.length ? list(spec.finish_options) : spec.surface_finish ?? "—"} />
                <SpecRow label="Colour / coating" value={spec.colour_coating ?? "—"} />
                <SpecRow label="Surface roughness" value={spec.surface_roughness ?? "—"} />
                <SpecRow label="Threads & tapped holes" value={spec.threads_qty ? `${spec.threads_qty} qty` : "Not required"} />
                <SpecRow label="Inserts" value={spec.inserts_qty ? `${spec.inserts_qty} qty` : "Not required"} />
                <SpecRow label="Part marking" value={list(spec.part_marking)} />
                <SpecRow label="Inspection" value={spec.inspection ?? "—"} />
                <SpecRow label="Certificates" value={list(spec.certificates)} />
                {spec.confirmed_lead_days != null && (
                  <SpecRow label="Lead time promised to buyer" value={`${spec.confirmed_lead_days} days`} />
                )}
              </div>
              {spec.special_instructions && (
                <div className="border-t border-grid px-5 py-3.5 text-[13px] text-ink-2">
                  <span className="mb-1 block font-semibold text-ink">Special instructions</span>
                  {spec.special_instructions}
                </div>
              )}
              <div className="border-t border-grid px-5 py-3.5 text-[13px]">
                <span className="mb-1.5 block font-semibold text-ink">CAD files</span>
                {cadFileLinks.length ? (
                  <ul className="space-y-1">
                    {cadFileLinks.map((f) => (
                      <li key={f.url}>
                        <a href={f.url} target="_blank" rel="noreferrer" className="font-semibold text-brand">
                          {f.name} ↓
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted">No files attached.</span>
                )}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4.5">
          <Card>
            <CardHeader title="Order Summary" />
            <div className="divide-y divide-grid">
              <SpecRow label="Buyer" value={buyerName ?? "—"} />
              <SpecRow label="Order type" value={order.order_type === "custom_part" ? "Custom Part" : "Raw Material"} />
              <SpecRow label="Status" value={<Badge tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge>} />
              <SpecRow label="Tracking number" value={order.tracking_number ?? "—"} />
              {assignment && <SpecRow label="Assigned" value={formatDate(assignment.assigned_at)} />}
              <SpecRow label="Created" value={formatDate(order.created_at)} />
              <SpecRow label="Updated" value={formatDate(order.updated_at)} />
            </div>
            {order.invoice_url && (
              <div className="border-t border-grid px-5 py-3.5">
                <a href={order.invoice_url} target="_blank" rel="noreferrer" className="text-[12.5px] font-semibold text-brand">
                  View invoice →
                </a>
              </div>
            )}
          </Card>

          {assignment?.note && (
            <Card className="border-[#f5dfa6] bg-warn-bg px-5 py-3.5 text-[13px] text-[#8a5a00]">
              <span className="mb-1 block font-semibold">Note from MECHmetriQ</span>
              {assignment.note}
            </Card>
          )}

          <Card>
            <CardHeader title="Update Status" />
            {next ? (
              <StatusUpdateForm orderId={order.id} nextStatus={next} />
            ) : (
              <div className="px-5 py-6 text-center text-[13px] text-muted">
                No further vendor action available for this order&rsquo;s current stage.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-3 text-[13px]">
      <span className="text-ink-2">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
