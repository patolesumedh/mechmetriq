import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  IDLE_TIMEOUT_MS,
  LAST_SEEN_COOKIE,
  REMEMBER_COOKIE,
  REMEMBER_IDLE_TIMEOUT_MS,
} from "@/lib/auth/sessionPolicy";

/**
 * Next.js 16 renamed "middleware.ts" to "proxy.ts" (named export `proxy`,
 * nodejs runtime only). This runs on every request to:
 *  - refresh the Supabase auth session and keep cookies in sync between the
 *    browser and server;
 *  - sign out sessions idle for longer than the timeout (F1.6);
 *  - pass the request path to Server Components as `x-pathname` (used by
 *    requireAccountFor in src/lib/auth/guard.ts).
 *
 * See: node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
 */
export async function proxy(request: NextRequest) {
  const next = () => {
    const headers = new Headers(request.headers);
    headers.set("x-pathname", request.nextUrl.pathname);
    return NextResponse.next({ request: { headers } });
  };
  let response = next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = next();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touching getUser() is what actually refreshes an expiring session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return response;

  const now = Date.now();
  const lastSeen = Number(request.cookies.get(LAST_SEEN_COOKIE)?.value);
  const limit =
    request.cookies.get(REMEMBER_COOKIE)?.value === "1" ? REMEMBER_IDLE_TIMEOUT_MS : IDLE_TIMEOUT_MS;

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
