import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDate, quoteStatusTone } from "../../badge-utils";
import { QuoteForm } from "./QuoteForm";

export default async function RfqDetailPage({
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

  const { data: rfq } = await supabase
    .from("rfqs")
    .select(
      "*, process:master_items!rfqs_process_id_fkey(name), material:master_items!rfqs_material_id_fkey(id, name), delivery_address:addresses(pincode, label)"
    )
    .eq("id", id)
    .single();

  if (!rfq) notFound();

  const r = rfq as unknown as {
    id: string;
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
    lead_time_pref: string | null;
    special_instructions: string | null;
    cad_file_urls: string[] | null;
    status: "pending" | "quoted" | "accepted" | "expired" | "cancelled";
    created_at: string;
    process: { name: string } | null;
    material: { id: string; name: string } | null;
    delivery_address: { pincode: string; label: string } | null;
  };

  const [{ data: existingQuote }, { data: materialOptions }] = await Promise.all([
    supabase
      .from("quotes")
      .select("*")
      .eq("rfq_id", id)
      .eq("vendor_id", vendorProfile.id)
      .maybeSingle(),
    supabase.from("master_items").select("*").eq("type", "material").eq("status", "active").order("name"),
  ]);

  // cad_file_urls stores private storage paths (bucket: rfq-attachments), not
  // public URLs — resolve short-lived signed URLs to actually render them.
  let cadFileLinks: { name: string; url: string }[] = [];
  if (r.cad_file_urls && r.cad_file_urls.length > 0) {
    const { data: signed } = await supabase.storage
      .from("rfq-attachments")
      .createSignedUrls(r.cad_file_urls, 60 * 60);
    cadFileLinks = (signed ?? [])
      .map((s, i) => ({
        name: r.cad_file_urls![i].split("/").pop() ?? `CAD file ${i + 1}`,
        url: s.signedUrl,
      }))
      .filter((f): f is { name: string; url: string } => !!f.url);
  }

  return (
    <div>
      <Topbar
        title={`RFQ ${r.id.slice(0, 8).toUpperCase()}`}
        pill={{ label: r.status === "pending" ? "New" : r.status, tone: "orange" }}
      />

      <div className="mt-6 grid grid-cols-2 gap-4.5">
        <div>
          <Card>
            <CardHeader title="Request Details" />
            <div className="divide-y divide-grid">
              <SpecRow label="Process" value={r.process?.name ?? "—"} />
              <SpecRow label="Preferred subprocess" value={r.subprocess ?? "—"} />
              <SpecRow label="Material" value={r.material?.name ?? "—"} />
              <SpecRow label="Quantity" value={`${r.quantity} pcs`} />
              <SpecRow label="Precision tolerance" value={r.tolerance ?? "—"} />
              <SpecRow
                label="Finish"
                value={r.finish_options && r.finish_options.length > 0 ? r.finish_options.join(", ") : r.surface_finish ?? "—"}
              />
              <SpecRow label="Colour / coating" value={r.colour_coating ?? "—"} />
              <SpecRow label="Precision surface roughness" value={r.surface_roughness ?? "—"} />
              <SpecRow
                label="Threads & tapped holes"
                value={r.threads_qty ? `${r.threads_qty} qty` : "Not required"}
              />
              <SpecRow
                label="Inserts"
                value={r.inserts_qty ? `${r.inserts_qty} qty` : "Not required"}
              />
              <SpecRow
                label="Part marking"
                value={r.part_marking && r.part_marking.length > 0 ? r.part_marking.join(", ") : "—"}
              />
              <SpecRow label="Inspection" value={r.inspection ?? "—"} />
              <SpecRow
                label="Certificates required"
                value={r.certificates && r.certificates.length > 0 ? r.certificates.join(", ") : "—"}
              />
              <SpecRow label="Target lead time" value={r.lead_time_pref ?? "—"} />
              <SpecRow label="Delivery pincode" value={r.delivery_address?.pincode ?? "—"} />
              <SpecRow label="Received" value={formatDate(r.created_at)} />
            </div>
            {r.special_instructions && (
              <div className="border-t border-grid px-5 py-3.5 text-[13px] text-ink-2">
                <span className="mb-1 block font-semibold text-ink">Special instructions</span>
                {r.special_instructions}
              </div>
            )}
            {cadFileLinks.length > 0 && (
              <div className="space-y-2 border-t border-grid px-5 py-3.5">
                {cadFileLinks.map((file, i) => (
                  <a
                    key={i}
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate rounded-lg border border-grid bg-plane px-3.5 py-2.5 text-[12.5px] font-semibold text-brand"
                  >
                    📎 {file.name} — Download &amp; view
                  </a>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div>
          {existingQuote ? (
            <Card>
              <CardHeader title="Your Quote" />
              <div className="p-5">
                <div className="mb-4">
                  <Badge tone={quoteStatusTone(existingQuote.status)}>{existingQuote.status}</Badge>
                </div>
                <div className="divide-y divide-grid">
                  <SpecRow label="Unit price" value={`₹${existingQuote.unit_price}`} />
                  <SpecRow label="Total price" value={`₹${existingQuote.total_price}`} />
                  <SpecRow label="Lead time" value={`${existingQuote.lead_time_days} days`} />
                  <SpecRow label="Valid until" value={formatDate(existingQuote.validity_date)} />
                </div>
                {existingQuote.notes && (
                  <div className="mt-3.5 text-[13px] text-ink-2">
                    <span className="mb-1 block font-semibold text-ink">Notes</span>
                    {existingQuote.notes}
                  </div>
                )}
              </div>
            </Card>
          ) : r.status === "pending" || r.status === "quoted" ? (
            <QuoteForm
              rfqId={r.id}
              quantity={r.quantity}
              materialOptions={materialOptions ?? []}
              defaultMaterialId={r.material?.id ?? null}
            />
          ) : (
            <Card>
              <div className="px-5 py-8 text-center text-[13px] text-muted">
                This RFQ is no longer open for quotes.
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-5 py-3 text-[13px]">
      <span className="text-ink-2">{label}</span>
      <b className="text-ink">{value}</b>
    </div>
  );
}
