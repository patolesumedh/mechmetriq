"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ListingFormState } from "../ListingForm";

export async function updateListingAction(
  _prevState: ListingFormState,
  formData: FormData
): Promise<ListingFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const id = formData.get("id") as string;
  if (!id) return { error: "Missing listing id." };

  const { data: vendor } = await supabase
    .from("vendor_profiles")
    .select("id")
    .eq("id", user.id)
    .single();
  if (!vendor) return { error: "Vendor profile not found." };

  const { data: existing } = await supabase
    .from("listings")
    .select("id,vendor_id")
    .eq("id", id)
    .single();
  if (!existing || existing.vendor_id !== vendor.id) {
    return { error: "You do not have permission to edit this listing." };
  }

  const materialId = (formData.get("material_id") as string | null)?.trim();
  const title = (formData.get("title") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const pricePerUnit = Number(formData.get("price_per_unit"));
  const unit = (formData.get("unit") as string | null)?.trim();
  const minOrderQty = Number(formData.get("min_order_qty"));
  const availableStock = Number(formData.get("available_stock"));
  const lowStockThresholdRaw = formData.get("low_stock_threshold") as string | null;
  const lowStockThreshold = lowStockThresholdRaw ? Number(lowStockThresholdRaw) : null;
  const gstRate = Number(formData.get("gst_rate"));
  const hsnCode = (formData.get("hsn_code") as string | null)?.trim();
  const dimensionsSpec = (formData.get("dimensions_spec") as string | null)?.trim();
  const imageUrlsRaw = (formData.get("image_urls") as string | null) ?? "";
  const imageUrls = imageUrlsRaw
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  const autoPublish = formData.get("auto_publish") === "on";

  if (
    !title ||
    !materialId ||
    !unit ||
    !dimensionsSpec ||
    Number.isNaN(pricePerUnit) ||
    Number.isNaN(minOrderQty) ||
    Number.isNaN(availableStock) ||
    Number.isNaN(gstRate)
  ) {
    return { error: "Please fill in all required fields." };
  }

  const { error } = await supabase
    .from("listings")
    .update({
      material_id: materialId,
      title,
      description: description || null,
      price_per_unit: pricePerUnit,
      unit,
      min_order_qty: minOrderQty,
      available_stock: availableStock,
      low_stock_threshold: lowStockThreshold,
      gst_rate: gstRate,
      hsn_code: hsnCode || null,
      dimensions_spec: dimensionsSpec || null,
      image_urls: imageUrls.length ? imageUrls : null,
      auto_publish: autoPublish,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/vendor/raw_material/listings");
  redirect("/vendor/raw_material/listings");
}

export async function toggleListingStatusAction(formData: FormData): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = formData.get("id") as string;
  const currentStatus = formData.get("current_status") as string;
  if (!id) return;

  const { data: vendor } = await supabase
    .from("vendor_profiles")
    .select("id")
    .eq("id", user.id)
    .single();
  if (!vendor) return;

  const { data: existing } = await supabase
    .from("listings")
    .select("id,vendor_id,status")
    .eq("id", id)
    .single();
  if (!existing || existing.vendor_id !== vendor.id) return;

  const nextStatus = currentStatus === "active" ? "inactive" : "active";
  // Only allow toggling between active <-> inactive; other statuses are
  // controlled by admin review and shouldn't be flipped from here.
  if (existing.status !== "active" && existing.status !== "inactive") return;

  await supabase.from("listings").update({ status: nextStatus }).eq("id", id);

  revalidatePath(`/vendor/raw_material/listings/${id}`);
  revalidatePath("/vendor/raw_material/listings");
  revalidatePath("/vendor/raw_material");
}
