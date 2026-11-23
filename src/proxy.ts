import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  IDLE_TIMEOUT_MS,
  LAST_SEEN_COOKIE,
  REMEMBER_COOKIE,
  REMEMBER_IDLE_TIMEOUT_MS,
} from "@/lib/auth/sessionPolicy";
import { isFromEdge } from "@/lib/security/originVerify";

/**
 * Next.js 16 renamed "middleware.ts" to "proxy.ts" (named export `proxy`,
 * nodejs runtime only). This runs on every request to:
 *  - verify the Cloudflare Worker origin lock (`x-origin-verify`);
 *  - refresh the Supabase auth session and keep cookies in sync between the
 *    browser and server;
 *  - sign out sessions idle for longer than the timeout (F1.6);
 *  - pass the request path to Server Components as `x-pathname` (used by
 *    requireAccountFor in src/lib/auth/guard.ts).
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Exemptions (both safe to reach directly on *.run.app):
  //  - /api/internal/*: worker->web callback, authenticated by HMAC instead
  //  - /api/health:     returns {"status":"ok"} only; lets CI check a no-traffic revision
  const exempt = path.startsWith("/api/internal/") || path.startsWith("/api/health");
  if (!exempt && !isFromEdge(request.headers.get("x-origin-verify"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  if (exempt) {
    return NextResponse.next();
  }

  const next = () => {
    const headers = new Headers(request.headers);
    headers.set("x-pathname", path);
    return NextResponse.next({ request: { headers } });
  };
  let response = next();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("your-project.supabase.co")) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = next();
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Touching getUser() is what actually refreshes an expiring session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return response;

  const now = Date.now();
  const lastSeen = Number(request.cookies.get(LAST_SEEN_COOKIE)?.value);
  const limit =
    request.cookies.get(REMEMBER_COOKIE)?.value === "1"
      ? REMEMBER_IDLE_TIMEOUT_MS
      : IDLE_TIMEOUT_MS;

  if (lastSeen && now - lastSeen > limit) {
    // Ends this session server-side too, not just the cookies.
    await supabase.auth.signOut({ scope: "local" });
    const out =
      request.method === "GET"
        ? NextResponse.redirect(new URL("/login?reason=idle", request.url))
        : response;
    if (out !== response) response.cookies.getAll().forEach((c) => out.cookies.set(c));
    out.cookies.delete(LAST_SEEN_COOKIE);
    return out;
  }

  response.cookies.set(LAST_SEEN_COOKIE, String(now), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REMEMBER_IDLE_TIMEOUT_MS / 1000,
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
