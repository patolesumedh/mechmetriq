"use client";

import { useActionState } from "react";
import { AuthError, AuthField, AuthNotice, AuthSubmit } from "@/components/auth/AuthCard";
import { verifyEmailAction, type VerifyEmailState } from "./actions";

export function VerifyEmailForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<VerifyEmailState, FormData>(verifyEmailAction, {
    email,
  });

  return (
    <>
      {state.error ? <AuthError>{state.error}</AuthError> : state.notice && <AuthNotice>{state.notice}</AuthNotice>}
      <form action={formAction}>
        <input type="hidden" name="intent" value="verify" />
        {email ? (
          <input type="hidden" name="email" value={state.email} />
        ) : (
          <AuthField label="Email" name="email" type="email" autoComplete="email" defaultValue={state.email} required />
        )}
        <AuthField
          label="Verification code"
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,10}"
          maxLength={10}
          placeholder="6-digit code"
          autoFocus
          required
        />
        <AuthSubmit pending={pending} pendingLabel="Verifying…">
          Verify email
        </AuthSubmit>
      </form>
      <form action={formAction} className="mt-4 text-center text-[12.5px] text-ink-2">
        <input type="hidden" name="intent" value="resend" />
        <input type="hidden" name="email" value={state.email} />
        Didn&rsquo;t get it?{" "}
        <button type="submit" disabled={pending || !state.email} className="font-semibold text-brand disabled:opacity-60">
          Send a new code
        </button>
      </form>
    </>
  );
}
