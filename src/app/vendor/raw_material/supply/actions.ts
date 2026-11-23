"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface SupplyState {
  error?: string;
  saved?: number;
}

const PINCODE = /^[1-9][0-9]{5}$/;

export async function addSupplyAction(_prev: SupplyState, formData: FormData): Promise<SupplyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const shapeId = String(formData.get("shape_id") ?? "");
  const gradeIds = formData.getAll("grade_id").map(String).filter(Boolean);
  const pincode = String(formData.get("warehouse_pincode") ?? "").trim();
  const sizeRange = String(formData.get("size_range") ?? "").trim().slice(0, 120);
  const mtc = formData.get("mtc_available") === "on";
  const cut = formData.get("cut_to_size") === "on";

  if (!shapeId) return { error: "Choose a shape." };
  if (gradeIds.length === 0) return { error: "Tick at least one grade." };
  if (!PINCODE.test(pincode)) return { error: "Enter a valid 6-digit warehouse pincode." };

  const { error } = await supabase.from("rm_vendor_supply").upsert(
    gradeIds.map((grade_id) => ({
      vendor_id: user.id,
      shape_id: shapeId,
      grade_id,
      warehouse_pincode: pincode,
      size_range: sizeRange || null,
      mtc_available: mtc,
      cut_to_size: cut,
      active: true,
    })),
    { onConflict: "vendor_id,shape_id,grade_id" }
  );
  if (error) return { error: error.message };
  revalidatePath("/vendor/raw_material/supply");
  return { saved: gradeIds.length };
}

export async function toggleSupplyAction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  await supabase.from("rm_vendor_supply").update({ active }).eq("id", id);
  revalidatePath("/vendor/raw_material/supply");
}

export async function removeSupplyAction(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  await supabase.from("rm_vendor_supply").delete().eq("id", id);
  revalidatePath("/vendor/raw_material/supply");
}
