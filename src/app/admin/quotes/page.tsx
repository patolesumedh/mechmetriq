import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, Th, Td, EmptyRow } from "../_components/table";
import { formatDate, rfqStatusTone, titleCase } from "../_lib/format";

export default async function AdminQuotesPage() {
  const supabase = await createClient();

  const { data: rfqs } = await supabase
    .from("rfqs")
    .select("id, buyer_id, process_id, material_id, quantity, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const buyerIds = [...new Set((rfqs ?? []).map((r) => r.buyer_id))];
  const masterIds = [
    ...new Set(
      (rfqs ?? []).flatMap((r) => [r.process_id, r.material_id]).filter((v): v is string => !!v)
    ),
  ];
  const rfqIds = (rfqs ?? []).map((r) => r.id);

  let buyers: { id: string; full_name: string }[] = [];
  if (buyerIds.length) {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", buyerIds);
    buyers = data ?? [];
  }

  let masterItems: { id: string; name: string }[] = [];
  if (masterIds.length) {
    const { data } = await supabase.from("master_items").select("id, name").in("id", masterIds);
    masterItems = data ?? [];
  }

  let quotes: { id: string; rfq_id: string }[] = [];
  if (rfqIds.length) {
    const { data } = await supabase.from("quotes").select("id, rfq_id").in("rfq_id", rfqIds);
    quotes = data ?? [];
  }

  const buyerNameById = new Map(buyers.map((b) => [b.id, b.full_name]));
  const masterNameById = new Map(masterItems.map((m) => [m.id, m.name]));
  const quoteCountByRfq = new Map<string, number>();
  for (const q of quotes) {
    quoteCountByRfq.set(q.rfq_id, (quoteCountByRfq.get(q.rfq_id) ?? 0) + 1);
  }

  return (
    <div>
      <Topbar title="Quotes & RFQs" pill={{ label: `${rfqs?.length ?? 0} RFQs` }} />

      <div className="mt-6">
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Buyer</Th>
                <Th>Process</Th>
                <Th>Material</Th>
                <Th>Qty</Th>
                <Th>Status</Th>
                <Th>Quotes received</Th>
                <Th>Submitted</Th>
              </tr>
            </thead>
            <tbody>
              {(rfqs ?? []).length === 0 && <EmptyRow colSpan={7}>No RFQs submitted yet.</EmptyRow>}
              {(rfqs ?? []).map((r) => (
                <tr key={r.id}>
                  <Td strong>{buyerNameById.get(r.buyer_id) ?? "—"}</Td>
                  <Td>{r.process_id ? masterNameById.get(r.process_id) ?? "—" : "—"}</Td>
                  <Td>{r.material_id ? masterNameById.get(r.material_id) ?? "—" : "—"}</Td>
                  <Td>{r.quantity}</Td>
                  <Td>
                    <Badge tone={rfqStatusTone(r.status)}>{titleCase(r.status)}</Badge>
                  </Td>
                  <Td>{quoteCountByRfq.get(r.id) ?? 0}</Td>
                  <Td>{formatDate(r.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
