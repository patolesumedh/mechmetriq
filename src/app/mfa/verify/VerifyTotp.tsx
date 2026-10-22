"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthError, AuthField, AuthSubmit } from "@/components/auth/AuthCard";

/** Second step of a login with two-factor on: a code from the authenticator app. */
export function VerifyTotp() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").replace(/\D/g, "");
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp[0];
    if (listError || !factor) {
      setError(listError?.message ?? "No authenticator app is set up for this account.");
      setPending(false);
      return;
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) {
      setError("That code didn't match. Try the newest code from your app.");
      setPending(false);
      return;
    }
    // /login sends a signed-in user on to the screen for their status.
    router.replace("/login");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      {error && <AuthError>{error}</AuthError>}
      <AuthField
        label="6-digit code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        autoFocus
        required
      />
      <AuthSubmit pending={pending} pendingLabel="Verifying…">
        Verify
      </AuthSubmit>
    </form>
  );
}
