import { formatInr } from "@/lib/smartQuote/pricing";

interface PriceFields {
  price_status: string;
  price_tier: string | null;
  estimated_unit_price: number | null;
  estimated_total: number | null;
  estimated_lead_days: number | null;
  confirmed_unit_price: number | null;
  confirmed_total: number | null;
  confirmed_lead_days: number | null;
  price_note: string | null;
  lead_time_pref: string | null;
}

/** Smart Quote price line on a buyer's RFQ: estimate → confirmed. */
export function PriceBlock({ rfq }: { rfq: PriceFields }) {
  if (rfq.price_status === "confirmed" && rfq.confirmed_total != null) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grid bg-good-bg/60 px-5 py-3.5 text-[13px]">
        <div>
          <div className="font-semibold text-[#0a6b0a]">Price confirmed</div>
          <div className="text-ink-2">
            {formatInr(Number(rfq.confirmed_unit_price ?? 0), 2)} each
            {rfq.confirmed_lead_days ? ` · ships in ${rfq.confirmed_lead_days} working days` : ""}
            {rfq.price_note ? ` · ${rfq.price_note}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[19px] font-extrabold text-ink">{formatInr(Number(rfq.confirmed_total))}</div>
          <div className="text-[11.5px] text-muted">+ GST · our team will contact you to place the order</div>
        </div>
      </div>
    );
  }
  if (rfq.price_status === "estimated" && rfq.estimated_total != null) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-grid px-5 py-3.5 text-[13px]">
        <div>
          <div className="font-semibold text-ink">
            Instant estimate{rfq.lead_time_pref ? ` · ${rfq.lead_time_pref}` : ""}
          </div>
          <div className="text-ink-2">
            {formatInr(Number(rfq.estimated_unit_price ?? 0), 2)} each
            {rfq.estimated_lead_days ? ` · about ${rfq.estimated_lead_days} working days` : ""} · awaiting
            confirmation by our team
          </div>
        </div>
        <div className="text-right">
          <div className="text-[19px] font-extrabold text-ink">{formatInr(Number(rfq.estimated_total))}</div>
          <div className="text-[11.5px] text-muted">+ GST · estimate</div>
        </div>
      </div>
    );
  }
  return null;
}
