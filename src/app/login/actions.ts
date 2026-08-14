"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profile?.role === "admin") redirect("/admin");
  if (profile?.role === "vendor") {
    const { data: vendorProfile } = await supabase
      .from("vendor_profiles")
      .select("vendor_type")
      .eq("id", data.user.id)
      .single();
    redirect(`/vendor/${vendorProfile?.vendor_type ?? "fabrication"}`);
  }
  redirect("/buyer");
}
