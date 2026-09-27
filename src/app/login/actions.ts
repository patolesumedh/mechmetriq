"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";
import { safeNextPath } from "@/lib/rawMaterials/format";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  const dashboard = await getDashboardPath(supabase, data.user.id);
  // Honour ?next= only for buyers (the marketplace/cart); everyone else goes home.
  const next = safeNextPath(formData.get("next") as string | null);
  redirect(next && dashboard === "/buyer" ? next : dashboard);
}
