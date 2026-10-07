import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { formatDate } from "../../../_lib/ui";
import { CheckoutForm } from "./CheckoutForm";
import { QUOTE_VALID_DAYS, quoteValidity } from "@/lib/smartQuote/validity";

const GST_RATE = 0.18;

export default async function QuoteCheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/buyer/quotes/${id}/checkout`);

  const { data: rfq } = await supabase.from("rfqs").select("*").eq("id", id).maybeSingle();
  if (!rfq || rfq.buyer_id !== user.id) notFound();

  if (rfq.status === "accepted") {
    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("source_rfq_id", rfq.id)
      .maybeSingle();
    redirect(order ? `/buyer/orders/${order.id}` : "/buyer/orders");
  }
  if (rfq.price_status !== "confirmed" || rfq.confirmed_total == null || rfq.status !== "quoted") {
    redirect("/buyer/quotes");
  }

  const { validUntil, expired } = quoteValidity(rfq.confirmed_at ?? rfq.created_at);

  const [{ data: items }, { data: grade }, { data: analysis }, { data: addresses }, { data: profile }] =
    await Promise.all([
      supabase
        .from("master_items")
        .select("id, name")
        .in("id", [rfq.process_id, rfq.material_id].filter((v): v is string => !!v)),
      rfq.rm_grade_id
        ? supabase.from("rm_grades").select("name").eq("id", rfq.rm_grade_id).maybeSingle()
        : Promise.resolve({ data: null }),
      rfq.analysis_id
        ? supabase.from("cad_analyses").select("thumbnail_path").eq("id", rfq.analysis_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("addresses")
        .select("id, label, full_address, pincode, is_default")
        .eq("profile_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase.from("profiles").select("full_name, email, phone, gstin, organization_name").eq("id", user.id).single(),
    ]);

  const nameOf = new Map((items ?? []).map((i) => [i.id, i.name]));
  const processName = nameOf.get(rfq.process_id ?? "") ?? "CNC Machining";
  const materialName = grade?.name ?? nameOf.get(rfq.material_id ?? "") ?? "—";
  const fileName =
    (rfq.cad_file_urls ?? [])[0]?.split("/").pop()?.replace(/^\d{10,}-/, "") ?? "Custom part";
  const thumbUrl = analysis?.thumbnail_path
    ? (await supabase.storage.from("rfq-attachments").createSignedUrl(analysis.thumbnail_path, 600)).data
        ?.signedUrl
    : null;

  const subtotal = Number(rfq.confirmed_total);
  const gst = Math.round(subtotal * GST_RATE * 100) / 100;
  const total = Math.round((subtotal + gst) * 100) / 100;
  const unit = Number(rfq.confirmed_unit_price ?? subtotal / rfq.quantity);
  const reference = `RFQ-${rfq.id.slice(0, 8).toUpperCase()}`;

  const specs: [string, string][] = [
    ["Process", processName],
    ["Material", materialName],
    ["Quantity", `${rfq.quantity} pcs`],
    ["Finish", (rfq.finish_options ?? []).join(", ") || rfq.surface_finish || "Standard (as machined)"],
    ["Tolerance", rfq.tolerance || "Standard"],
    ["Roughness", rfq.surface_roughness || "Standard"],
    ["Inspection", rfq.inspection || "Standard Inspection"],
    ["Certificates", (rfq.certificates ?? []).join(", ") || "—"],
    ["Lead time", rfq.confirmed_lead_days ? `${rfq.confirmed_lead_days} working days` : "—"],
  ];

  return (
    <>
      <div className="-mx-7 -mt-7 mb-7">
        <Topbar title="Checkout" pill={{ label: "Custom part" }} />
      </div>

      <nav className="mb-5 flex items-center gap-2 text-[12.5px] text-muted">
        <Link href="/buyer/quotes" className="hover:text-brand">
          Quotes &amp; Cart
        </Link>
        <span>/</span>
        <span className="font-semibold text-ink-2">Accept &amp; pay</span>
      </nav>

      <CheckoutSteps active={1} />

      {expired ? (
        <Card className="flex flex-col items-center gap-3 px-5 py-14 text-center">
          <div className="text-[15px] font-bold text-ink">This quote expired on {formatDate(validUntil)}</div>
          <p className="max-w-md text-[13.5px] text-ink-2">
            Confirmed prices are held for {QUOTE_VALID_DAYS} days. Request a fresh quote and our team will re-confirm the
            price.
          </p>
          <ButtonLink href="/buyer/quote">Get a new quote</ButtonLink>
        </Card>
      ) : (
        <CheckoutForm
          rfqId={rfq.id}
          defaultAddressId={rfq.delivery_address_id}
          addresses={addresses ?? []}
          defaultGstin={profile?.gstin ?? ""}
          organization={profile?.organization_name ?? null}
          description={`${fileName} · ${rfq.quantity} pcs`}
          reference={reference}
          contact={{ email: profile?.email ?? user.email ?? "", phone: profile?.phone ?? null }}
          summary={{
            unit,
            quantity: rfq.quantity,
            subtotal,
            gst,
            total,
            validUntil: formatDate(validUntil),
            leadDays: rfq.confirmed_lead_days,
          }}
        >
          <Card>
            <CardHeader title="Your part" />
            <div className="flex gap-4 px-5 py-4">
              <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-grid bg-plane">
                {thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbUrl} alt={`Preview of ${fileName}`} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[11px] font-bold uppercase text-muted">
                    {fileName.split(".").pop()?.slice(0, 4) ?? "CAD"}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-bold text-ink">{fileName}</div>
                <div className="text-[12.5px] text-muted">
                  {processName} · {materialName}
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
                  {specs.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 border-b border-dashed border-grid pb-1">
                      <dt className="text-muted">{k}</dt>
                      <dd className="truncate text-right font-medium text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
                {rfq.price_note && (
                  <p className="mt-3 rounded-lg bg-brand-light px-3 py-2 text-[12.5px] text-brand-dark">
                    Note from MECHmetriQ: {rfq.price_note}
                  </p>
                )}
              </div>
            </div>
          </Card>
        </CheckoutForm>
      )}
    </>
  );
}

function CheckoutSteps({ active }: { active: number }) {
  const steps = ["Quote confirmed", "Review & pay", "Order placed"];
  return (
    <ol className="mb-6 flex items-center gap-2 text-[12.5px]">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={
              "grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold " +
              (i < active ? "bg-good text-white" : i === active ? "bg-brand text-white" : "bg-grid text-muted")
            }
          >
            {i < active ? "✓" : i + 1}
          </span>
          <span className={i === active ? "font-semibold text-ink" : "text-muted"}>{s}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-8 bg-grid sm:w-14" />}
        </li>
      ))}
    </ol>
  );
}
