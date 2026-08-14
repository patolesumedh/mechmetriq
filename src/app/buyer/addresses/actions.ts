"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addAddressAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const label = ((formData.get("label") as string) || "").trim();
  const fullAddress = ((formData.get("full_address") as string) || "").trim();
  const pincode = ((formData.get("pincode") as string) || "").trim();
  const isDefault = formData.get("is_default") === "on";

  if (!label || !fullAddress || !pincode) {
    return;
  }

  if (isDefault) {
    await supabase.from("addresses").update({ is_default: false }).eq("profile_id", user.id);
  }

  await supabase.from("addresses").insert({
    profile_id: user.id,
    label,
    full_address: fullAddress,
    pincode,
    is_default: isDefault,
  });

  revalidatePath("/buyer/addresses");
}

export async function deleteAddressAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const addressId = formData.get("address_id") as string;
  if (!addressId) return;

  await supabase.from("addresses").delete().eq("id", addressId).eq("profile_id", user.id);

  revalidatePath("/buyer/addresses");
}
