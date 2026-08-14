"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function resolveDisputeAction(formData: FormData) {
  const disputeId = formData.get("disputeId") as string;
  const resolution = ((formData.get("resolution") as string) ?? "").trim();

  if (!resolution) {
    redirect(`/admin/disputes?error=resolution_required`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("disputes")
    .update({
      status: "resolved",
      resolution,
      resolved_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", disputeId);

  revalidatePath("/admin/disputes");
  revalidatePath("/admin");
  redirect(`/admin/disputes?msg=resolved`);
}
