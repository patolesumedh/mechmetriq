"use client";

import { useActionState } from "react";
import { AuthError, AuthField, AuthNotice, AuthSubmit } from "@/components/auth/AuthCard";
import { resendVerificationAction, type ResendState } from "./actions";

const initialState: ResendState = {};

export function ResendForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(resendVerificationAction, initialState);

  return (
    <form action={formAction}>
      {state.error && <AuthError>{state.error}</AuthError>}
      {state.sent && <AuthNotice>Sent. Check your inbox (and spam folder).</AuthNotice>}
      <AuthField label="Email" name="email" type="email" defaultValue={email} autoComplete="email" required />
      <AuthSubmit pending={pending} pendingLabel="Sending…">
        Resend verification email
      </AuthSubmit>
    </form>
  );
}
