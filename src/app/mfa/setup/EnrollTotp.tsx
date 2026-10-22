"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthError, AuthField, AuthSubmit } from "@/components/auth/AuthCard";

/**
 * Enrols an authenticator app (TOTP) as the admin's second factor. Clears
 * any half-finished enrolment first, shows the QR code + secret, then
 * verifies the first code, which upgrades this session to aal2.
 */
export function EnrollTotp() {
  const router = useRouter();
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const f of factors?.all ?? []) {
        if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
      });
      if (cancelled) return;
      if (error) setError(error.message);
      else setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!factor) return;
    const code = String(new FormData(e.currentTarget).get("code") ?? "").replace(/\D/g, "");
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) {
      setError("That code didn't match. Check your phone's time is correct and try the newest code.");
      setPending(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <>
      {error && <AuthError>{error}</AuthError>}
      {!factor ? (
        !error && <p className="mb-4 text-[13px] text-ink-2">Preparing your QR code…</p>
      ) : (
        <form onSubmit={onSubmit}>
          <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-[13px] text-ink-2">
            <li>Open Google Authenticator, Microsoft Authenticator, 1Password or similar.</li>
            <li>Scan this QR code (or enter the key below).</li>
            <li>Type the 6-digit code the app shows.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URL SVG from Supabase */}
          <img src={factor.qr} alt="QR code for your authenticator app" width={180} height={180} className="mx-auto mb-3 rounded-lg border border-grid bg-white p-2" />
          <p className="mb-4 break-all text-center font-mono text-[12px] text-muted">{factor.secret}</p>
          <AuthField
            label="6-digit code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
          />
          <AuthSubmit pending={pending} pendingLabel="Verifying…">
            Turn on two-factor login
          </AuthSubmit>
        </form>
      )}
    </>
  );
}
