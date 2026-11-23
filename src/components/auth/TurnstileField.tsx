"use client";

import { useEffect, useRef } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

/**
 * Renders a Cloudflare Turnstile CAPTCHA widget that injects the hidden
 * `cf-turnstile-response` form field for Supabase Auth bot protection.
 * Gracefully renders nothing in local development if `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset.
 */
export function TurnstileField({
  action,
  resetSignal,
}: {
  action?: string;
  /** Pass form action state so single-use tokens reset after a failed submission. */
  resetSignal?: unknown;
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const ref = useRef<TurnstileInstance | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    ref.current?.reset();
  }, [resetSignal]);

  if (!siteKey) return null;

  return (
    <div className="my-3 flex justify-center">
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        options={{
          action,
          theme: "light",
          size: "normal",
        }}
      />
    </div>
  );
}
