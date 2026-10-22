import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";
import { safeNextPath } from "@/lib/rawMaterials/format";

/**
 * Landing point for links in Supabase auth emails (sign-up confirmation,
 * password reset, email change). Handles both the default PKCE `?code=` links
 * and `?token_hash=&type=` links from customised email templates, then sends
 * the user on: to `?next=` when given (e.g. /reset-password), otherwise to
 * the screen for their status.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  const supabase = await createClient();
  let ok = false;

  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  if (!ok) {
    const failed = next === "/reset-password" ? "/forgot-password?error=link" : "/login?error=link";
    return NextResponse.redirect(new URL(failed, request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const destination = next ?? (user ? await getDashboardPath(supabase, user.id) : "/login");
  return NextResponse.redirect(new URL(destination, request.url));
}
