import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/rawMaterials/PrintButton";
import { RmLinesTable, RmTotals } from "@/components/rawMaterials/RmOrderParts";
import { rmStatusLabel } from "@/lib/rawMaterials/format";
import { sellerDetails } from "@/lib/rawMaterials/seller";
import { formatDate } from "../../../_lib/ui";

export default async function ProformaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();
  if (!order || order.buyer_id !== user.id || order.order_type !== "raw_material") notFound();

  const [{ data: items }, { data: buyer }, { data: address }] = await Promise.all([
    supabase.from("order_items").select("*").eq("order_id", order.id).order("rm_line_no"),
    supabase.from("profiles").select("full_name, email, phone").eq("id", user.id).single(),
    order.delivery_address_id
      ? supabase.from("addresses").select("label, full_address, pincode").eq("id", order.delivery_address_id).single()
      : Promise.resolve({ data: null }),
  ]);
  const seller = sellerDetails();
  const approved = !["draft", "cancelled"].includes(order.status);

  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/buyer/orders/${order.id}`} className="text-[13px] font-semibold text-brand">
          &larr; Back to order
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-xl border border-grid bg-surface p-8 print:border-0 print:p-0">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-grid pb-5">
          <div>
            <div className="text-[20px] font-extrabold tracking-tight">{seller.legalName}</div>
            {seller.address && <div className="max-w-[320px] text-[12px] text-ink-2">{seller.address}</div>}
            <div className="text-[12px] text-ink-2">
              {seller.gstin ? `GSTIN ${seller.gstin}` : "GSTIN: to be printed on the tax invoice"} · {seller.email}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[18px] font-bold uppercase tracking-wide">Proforma invoice</div>
            <div className="text-[12.5px] text-ink-2">No. PI-{order.order_number}</div>
            <div className="text-[12.5px] text-ink-2">Date {formatDate(order.created_at)}</div>
            <div className="mt-1 text-[12px] font-semibold">{rmStatusLabel(order.status)}</div>
          </div>
        </header>

        <section className="mb-6 grid gap-6 text-[12.5px] sm:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Bill to</div>
            <div className="font-semibold text-ink">{buyer?.full_name}</div>
            <div className="text-ink-2">{buyer?.email}</div>
            {buyer?.phone && <div className="text-ink-2">{buyer.phone}</div>}
            <div className="text-ink-2">GSTIN: {order.billing_gstin ?? "Unregistered"}</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Ship to</div>
            {address ? (
              <div className="text-ink-2">
                <b className="text-ink">{address.label}</b>
                <br />
                {address.full_address} — {address.pincode}
              </div>
            ) : (
              "—"
            )}
          </div>
        </section>

        <div className="mb-6 rounded-lg border border-grid">
          <RmLinesTable items={items ?? []} />
        </div>

        <div className="flex flex-wrap justify-between gap-6">
          <div className="max-w-[420px] text-[11.5px] leading-relaxed text-ink-2">
            <b className="text-ink">Terms.</b> Prices are on theoretical weight at the rate card in force when the order
            was placed. {approved ? "" : "Freight is added when the order is approved; this proforma will update. "}
            Payment is due after approval and before dispatch. GST is charged per HSN at the rates shown; a tax
            invoice and e-way bill accompany the goods.
          </div>
          <div className="w-full max-w-[300px]">
            <RmTotals order={order} />
          </div>
        </div>
      </article>
    </div>
  );
}
