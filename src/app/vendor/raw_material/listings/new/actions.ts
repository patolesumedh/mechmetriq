"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ListingFormState } from "../ListingForm";

export async function createListingAction(
  _prevState: ListingFormState,
  formData: FormData
): Promise<ListingFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in." };

  const { data: vendor } = await supabase
    .from("vendor_profiles")
    .select("id,vendor_type")
    .eq("id", user.id)
    .single();
  if (!vendor || vendor.vendor_type !== "raw_material") {
    return { error: "Only raw material vendors can create listings." };
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

  const { error } = await supabase.from("listings").insert({
    vendor_id: vendor.id,
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
    status: autoPublish ? "active" : "pending_review",
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/vendor/raw_material/listings");
}
