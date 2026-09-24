"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logKycEvent } from "./server";

/** Vendor asks for their KYC data to be deleted (handled by the admin team). */
export async function requestKycDeletionAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("vendor_kyc")
    .upsert(
      { vendor_id: user.id, deletion_requested_at: new Date().toISOString() },
      { onConflict: "vendor_id" }
    );
  if (error) {
    console.error("deletion request failed", error.code);
    return;
  }
  await logKycEvent(supabase, user.id, "deletion_request");
  revalidatePath("/vendor", "layout");
}
