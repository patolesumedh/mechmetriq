import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";
import { safeNextPath } from "@/lib/rawMaterials/format";

/**
 * Landing point for links in Supabase auth emails (sign-up confirmation,
 * password reset, email change). Handles PKCE `?code=` links, `?token_hash=`
 * links from customised email templates, and implicit-flow links (forwarded
 * to /auth/confirm), then sends
 * the user on: to `?next=` when given (e.g. /reset-password), otherwise to
 * the screen for their status.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  // Implicit-flow links (see src/lib/supabase/emailLinks.ts) carry the
  // session in the URL #fragment, which never reaches the server. Hand over
  // to the client page; browsers keep the fragment across this redirect.
  if (!code && !tokenHash) {
    return NextResponse.redirect(new URL(`/auth/confirm${request.nextUrl.search}`, request.url));
  }

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
