"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function approveVendorAction(formData: FormData) {
  const vendorId = formData.get("vendorId") as string;

  const supabase = await createClient();
  await supabase
    .from("vendor_profiles")
    .update({ kyc_status: "approved", kyc_rejection_reason: null })
    .eq("id", vendorId);

  revalidatePath(`/admin/vendors/${vendorId}`);
  revalidatePath("/admin/vendors");
  revalidatePath("/admin");
  redirect(`/admin/vendors/${vendorId}?msg=approved`);
}

export async function rejectVendorAction(formData: FormData) {
  const vendorId = formData.get("vendorId") as string;
  const reason = ((formData.get("reason") as string) ?? "").trim();

  if (!reason) {
    redirect(`/admin/vendors/${vendorId}?error=reason_required`);
  }

  const supabase = await createClient();
  await supabase
    .from("vendor_profiles")
    .update({ kyc_status: "rejected", kyc_rejection_reason: reason })
    .eq("id", vendorId);

  revalidatePath(`/admin/vendors/${vendorId}`);
  revalidatePath("/admin/vendors");
  redirect(`/admin/vendors/${vendorId}?msg=rejected`);
}

export async function holdVendorAction(formData: FormData) {
  const vendorId = formData.get("vendorId") as string;

  const supabase = await createClient();
  await supabase
    .from("vendor_profiles")
    .update({ kyc_status: "on_hold" })
    .eq("id", vendorId);

  revalidatePath(`/admin/vendors/${vendorId}`);
  revalidatePath("/admin/vendors");
  redirect(`/admin/vendors/${vendorId}?msg=on_hold`);
}

export async function updateVendorMetaAction(formData: FormData) {
  const vendorId = formData.get("vendorId") as string;
  const commissionRaw = ((formData.get("commissionOverride") as string) ?? "").trim();
  const internalNotesRaw = ((formData.get("internalNotes") as string) ?? "").trim();

  const supabase = await createClient();
  await supabase
    .from("vendor_profiles")
    .update({
      commission_override: commissionRaw === "" ? null : Number(commissionRaw),
      internal_notes: internalNotesRaw === "" ? null : internalNotesRaw,
    })
    .eq("id", vendorId);

  revalidatePath(`/admin/vendors/${vendorId}`);
  redirect(`/admin/vendors/${vendorId}?msg=saved`);
}
