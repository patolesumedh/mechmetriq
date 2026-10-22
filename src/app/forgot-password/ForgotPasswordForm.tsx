"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthCard, AuthError, AuthField, AuthNotice, AuthSubmit } from "@/components/auth/AuthCard";
import { forgotPasswordAction, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm({ linkExpired }: { linkExpired: boolean }) {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initialState);

  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter the email you signed up with and we'll send you a link to set a new password."
    >
      {linkExpired && !state.sent && !state.error && (
        <AuthError>That reset link is invalid or has expired. Request a new one below.</AuthError>
      )}
      {state.error && <AuthError>{state.error}</AuthError>}

      {state.sent ? (
        <AuthNotice>
          If an account exists for that email, a reset link is on its way. It expires in 1 hour —
          open it in this browser. Check your spam folder if it doesn&rsquo;t arrive.
        </AuthNotice>
      ) : (
        <form action={formAction}>
          <AuthField label="Email" name="email" type="email" autoComplete="email" required />
          <AuthSubmit pending={pending} pendingLabel="Sending…">
            Send reset link
          </AuthSubmit>
        </form>
      )}

      <div className="mt-4 text-center text-[13px] text-ink-2">
        Remembered it?{" "}
        <Link href="/login" className="font-bold text-brand">
          Back to log in
        </Link>
      </div>
    </AuthCard>
  );
}
