"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";
import { normalizeMobile, toE164 } from "@/lib/auth/validation";
import { REMEMBER_COOKIE, REMEMBER_IDLE_TIMEOUT_MS } from "@/lib/auth/sessionPolicy";
import { safeNextPath } from "@/lib/rawMaterials/format";

export interface LoginState {
  error?: string;
  /** Set when the account exists but its email isn't verified yet. */
  unverifiedEmail?: boolean;
  identifier?: string;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const identifier = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rememberMe = formData.get("rememberMe") === "on";

  // Accepts an email, or a mobile number once it has been verified.
  const mobile = identifier.includes("@") ? null : normalizeMobile(identifier);
  if (!identifier.includes("@") && !mobile) {
    return { error: "Enter your email or 10-digit mobile number.", identifier };
  }

  const supabase = await createClient();
  const { data, error } = mobile
    ? await supabase.auth.signInWithPassword({ phone: toE164(mobile), password })
    : await supabase.auth.signInWithPassword({ email: identifier.toLowerCase(), password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        error: "Please verify your email first — check your inbox for the link.",
        unverifiedEmail: true,
        identifier,
      };
    }
    if (error.status === 429) {
      return { error: "Too many attempts. Please wait a few minutes and try again.", identifier };
    }
    // One message for unknown account and wrong password (no enumeration).
    return { error: "Incorrect email/mobile or password.", identifier };
  }

  const cookieStore = await cookies();
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
