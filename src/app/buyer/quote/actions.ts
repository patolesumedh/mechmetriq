"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface QuoteFormState {
  error?: string;
}

export async function createRfqAction(
  _prevState: QuoteFormState,
  formData: FormData
): Promise<QuoteFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const processId = (formData.get("process_id") as string) || "";
  const materialId = (formData.get("material_id") as string) || "";
  const quantity = Number(formData.get("quantity"));
  const tolerance = ((formData.get("tolerance") as string) || "").trim() || null;
  const surfaceFinish = ((formData.get("surface_finish") as string) || "").trim() || null;
  const colourCoating = ((formData.get("colour_coating") as string) || "").trim() || null;
  const leadTimePref = ((formData.get("lead_time_pref") as string) || "").trim() || null;
  const deliveryAddressId = (formData.get("delivery_address_id") as string) || "";
  const specialInstructions =
    ((formData.get("special_instructions") as string) || "").trim() || null;

  if (!processId) {
    return { error: "Please select a manufacturing process." };
  }
  if (!quantity || quantity <= 0) {
    return { error: "Please enter a valid quantity." };
  }

  const { error } = await supabase.from("rfqs").insert({
    buyer_id: user.id,
    process_id: processId,
    material_id: materialId || null,
    quantity,
    tolerance,
    surface_finish: surfaceFinish,
    colour_coating: colourCoating,
    lead_time_pref: leadTimePref,
    delivery_address_id: deliveryAddressId || null,
    special_instructions: specialInstructions,
    status: "pending",
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/buyer/quotes");
}
