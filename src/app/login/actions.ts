"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";
import { REMEMBER_COOKIE, REMEMBER_IDLE_TIMEOUT_MS } from "@/lib/auth/sessionPolicy";
import { safeNextPath } from "@/lib/rawMaterials/format";
import { PENDING_EMAIL_COOKIE } from "@/app/verify/email/constants";

export interface LoginState {
  error?: string;
  identifier?: string;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const rememberMe = formData.get("rememberMe") === "on";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  const cookieStore = await cookies();

  if (error) {
    if (error.code === "email_not_confirmed") {
      // Send them to enter the code from their sign-up email (or resend it).
      cookieStore.set(PENDING_EMAIL_COOKIE, email, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/verify",
        maxAge: 60 * 60,
      });
      redirect("/verify/email");
    }
    if (error.status === 429) {
      return { error: "Too many attempts. Please wait a few minutes and try again.", identifier: email };
    }
    // One message for unknown account and wrong password (no enumeration).
    return { error: "Incorrect email or password.", identifier: email };
  }

  if (rememberMe) {
    cookieStore.set(REMEMBER_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: REMEMBER_IDLE_TIMEOUT_MS / 1000,
    });
  } else {
    cookieStore.delete(REMEMBER_COOKIE);
  }

  const dashboard = await getDashboardPath(supabase, data.user.id);
  // Honour ?next= only for buyers (the marketplace/cart); everyone else goes home.
  const next = safeNextPath(formData.get("next") as string | null);
  redirect(next && dashboard === "/buyer" ? next : dashboard);
}
