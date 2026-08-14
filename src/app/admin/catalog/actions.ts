"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

type MasterItemType = Database["public"]["Enums"]["master_item_type"];

export async function createMasterItemAction(formData: FormData) {
  const type = formData.get("type") as MasterItemType;
  const name = ((formData.get("name") as string) ?? "").trim();
  const defaultUnit = ((formData.get("defaultUnit") as string) ?? "").trim();
  const hsnCode = ((formData.get("hsnCode") as string) ?? "").trim();
  const gstRateRaw = ((formData.get("gstRate") as string) ?? "").trim();
  const parentId = ((formData.get("parentId") as string) ?? "").trim();
  const applicableProcessesRaw = ((formData.get("applicableProcesses") as string) ?? "").trim();

  if (!name) {
    redirect(`/admin/catalog?error=name_required#${type}`);
  }

  const applicableProcesses = applicableProcessesRaw
    ? applicableProcessesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  const supabase = await createClient();
  await supabase.from("master_items").insert({
    type,
    name,
    default_unit: defaultUnit || null,
    hsn_code: hsnCode || null,
    gst_rate: gstRateRaw ? Number(gstRateRaw) : null,
    parent_id: parentId || null,
    applicable_processes: applicableProcesses,
  });

  revalidatePath("/admin/catalog");
  redirect(`/admin/catalog?msg=created#${type}`);
}

export async function toggleMasterItemStatusAction(formData: FormData) {
  const id = formData.get("id") as string;
  const type = (formData.get("type") as string) ?? "";
  const nextStatus = formData.get("nextStatus") as Database["public"]["Enums"]["master_status"];

  const supabase = await createClient();
  await supabase.from("master_items").update({ status: nextStatus }).eq("id", id);

  revalidatePath("/admin/catalog");
  redirect(`/admin/catalog?msg=updated#${type}`);
}
