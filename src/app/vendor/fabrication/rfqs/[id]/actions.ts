"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SubmitQuoteState {
  error?: string;
}

export async function submitQuoteAction(
  _prevState: SubmitQuoteState,
  formData: FormData
): Promise<SubmitQuoteState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const rfqId = formData.get("rfq_id") as string;
  const unitPriceRaw = formData.get("unit_price") as string;
  const leadTimeDaysRaw = formData.get("lead_time_days") as string;
  const validityDate = formData.get("validity_date") as string;
  const materialConfirmedId = (formData.get("material_confirmed_id") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  const unitPrice = Number(unitPriceRaw);
  const leadTimeDays = Number(leadTimeDaysRaw);

  if (!rfqId) {
    return { error: "Missing RFQ reference." };
  }
  if (!unitPriceRaw || Number.isNaN(unitPrice) || unitPrice <= 0) {
    return { error: "Enter a valid unit price." };
  }
  if (!leadTimeDaysRaw || Number.isNaN(leadTimeDays) || leadTimeDays <= 0) {
    return { error: "Enter a valid lead time in days." };
  }
  if (!validityDate) {
    return { error: "Quote validity date is required." };
  }

  const { data: vendorProfile } = await supabase
    .from("vendor_profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!vendorProfile) redirect("/login");

  const { data: rfq } = await supabase
    .from("rfqs")
    .select("id, quantity, status")
    .eq("id", rfqId)
    .single();

  if (!rfq) {
    return { error: "This RFQ could not be found." };
  }

  const totalPrice = unitPrice * rfq.quantity;

  const { error: insertError } = await supabase.from("quotes").insert({
    rfq_id: rfqId,
    vendor_id: vendorProfile.id,
    status: "submitted",
    unit_price: unitPrice,
    total_price: totalPrice,
    lead_time_days: leadTimeDays,
    validity_date: validityDate,
    material_confirmed_id: materialConfirmedId,
    notes,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  if (rfq.status === "pending") {
    await supabase.from("rfqs").update({ status: "quoted" }).eq("id", rfqId);
  }

  redirect("/vendor/fabrication/quotes");
}
