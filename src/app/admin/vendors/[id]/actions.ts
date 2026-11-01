"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/guard";
import { REVIEW_SECTIONS } from "@/lib/kyc/status";
import type { Database } from "@/lib/types/database";

const str = (fd: FormData, k: string, max = 1000) => String(fd.get(k) ?? "").trim().slice(0, max);

const ACTIONS = ["start_review", "request_correction", "approve", "reject", "suspend", "reactivate"] as const;
type DecisionAction = (typeof ACTIONS)[number];

function done(vendorId: string, query: string): never {
  revalidatePath(`/admin/vendors/${vendorId}`);
  revalidatePath("/admin/vendors");
  revalidatePath("/admin");
  redirect(`/admin/vendors/${vendorId}?${query}`);
}

/**
 * Every KYC status change goes through admin_set_kyc_status(), which checks
 * the transition is allowed, records reviewer + time and writes the review
 * history (F5.3 / F5.4).
 */
export async function kycDecisionAction(formData: FormData) {
  const vendorId = str(formData, "vendorId", 64);
  const action = str(formData, "action", 40) as DecisionAction;
  if (!ACTIONS.includes(action)) done(vendorId, "error=" + encodeURIComponent("Unknown action."));

  const remarks: Record<string, string> = {};
  if (action === "request_correction") {
    for (const s of REVIEW_SECTIONS) {
      const v = str(formData, `remark_${s.key}`);
      if (v) remarks[s.key] = v;
    }
  }

  const supabase = await requireAdminSession();
  const { error } = await supabase.rpc("admin_set_kyc_status", {
    p_vendor_id: vendorId,
    p_action: action,
    p_reason: str(formData, "reason") || undefined,
    p_remarks: remarks,
  });
  if (error) done(vendorId, "error=" + encodeURIComponent(error.message));
  done(vendorId, `msg=${action}`);
}

export async function setVendorTypeAction(formData: FormData) {
  const vendorId = str(formData, "vendorId", 64);
  const type = str(formData, "vendor_type", 20) as Database["public"]["Enums"]["vendor_type"];
  if (!["fabrication", "raw_material", "both"].includes(type)) {
    done(vendorId, "error=" + encodeURIComponent("Choose a vendor type."));
  }
  const supabase = await requireAdminSession();
  const { error } = await supabase.rpc("admin_set_vendor_type", { p_vendor_id: vendorId, p_type: type });
  if (error) done(vendorId, "error=" + encodeURIComponent(error.message));
  done(vendorId, "msg=type_changed");
}

/** Marks a duplicate-vendor flag as checked (F5.2). */
export async function resolveDuplicateAction(formData: FormData) {
  const vendorId = str(formData, "vendorId", 64);
  const flagId = Number(str(formData, "flagId", 20));
  const supabase = await requireAdminSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("vendor_duplicate_flags")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: user?.id ?? null,
      resolution_note: str(formData, "note", 300) || null,
    })
    .eq("id", flagId);
  if (error) done(vendorId, "error=" + encodeURIComponent("Couldn't update the flag."));
  done(vendorId, "msg=duplicate_resolved");
}

export async function updateVendorMetaAction(formData: FormData) {
  const vendorId = str(formData, "vendorId", 64);
  const commissionRaw = str(formData, "commissionOverride", 10);
  const internalNotesRaw = str(formData, "internalNotes", 4000);

  const supabase = await requireAdminSession();
  await supabase
    .from("vendor_profiles")
    .update({
      commission_override: commissionRaw === "" ? null : Number(commissionRaw),
      internal_notes: internalNotesRaw === "" ? null : internalNotesRaw,
    })
    .eq("id", vendorId);

  done(vendorId, "msg=saved");
}
