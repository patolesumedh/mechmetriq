"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthError } from "@/components/auth/AuthCard";

/** Only same-site paths, as in safeNextPath. */
function safeNext(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  return value.slice(0, 300);
}

/**
 * Finishes an implicit-flow email link: reads the session from the URL
 * #fragment, stores it in this browser's auth cookies, then moves on to
 * `?next=` (e.g. /reset-password) or, via /login, to the screen for the
 * user's status. Works in any browser, unlike PKCE links.
 */
export function ConfirmSession() {
  const [failure, setFailure] = useState<{ message: string; reset: boolean } | null>(null);
  // The fragment is read and cleared once; a second effect run (React dev
  // Strict Mode) would otherwise find it empty and report a bad link.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const next = safeNext(new URLSearchParams(window.location.search).get("next"));
    // Drop the tokens from the address bar and history straight away.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    const reset = next === "/reset-password" || hash.get("type") === "recovery";
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const expired = hash.get("error_code") === "otp_expired";

    const signedIn =
      hash.get("error") || !accessToken || !refreshToken
        ? Promise.resolve(false)
        : createClient()
            .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
            .then(({ error }) => !error);

    signedIn.then((ok) => {
      if (ok) {
        // A full navigation so the server sees the new auth cookies.
        window.location.replace(next ?? (reset ? "/reset-password" : "/login"));
        return;
      }
      setFailure({
        reset,
        message: expired ? "This link has expired or was already used." : "This link is invalid or has expired.",
      });
    });
  }, []);

  if (!failure) return <p className="text-[13px] text-ink-2">Signing you in…</p>;

  return (
    <>
      <AuthError>{failure.message}</AuthError>
      <Link
        href={failure.reset ? "/forgot-password" : "/login"}
        className="block w-full rounded-[9px] bg-brand py-3 text-center text-[14.5px] font-bold text-white"
      >
        {failure.reset ? "Request a new reset link" : "Go to log in"}
      </Link>
    </>
  );
}
