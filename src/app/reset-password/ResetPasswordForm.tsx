"use client";

import { useActionState } from "react";
import { AuthCard, AuthError, AuthField, AuthSubmit } from "@/components/auth/AuthCard";
import { PASSWORD_HINT } from "@/lib/auth/validation";
import { resetPasswordAction, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <AuthCard
      title="Set a new password"
      subtitle={
        <>
          For <b className="text-ink">{email}</b>. You&rsquo;ll be signed out on every other device.
        </>
      }
    >
      {state.error && <AuthError>{state.error}</AuthError>}
      <form action={formAction}>
        {/* Lets password managers save the new password against the right account. */}
        <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
        <AuthField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          hint={PASSWORD_HINT}
        />
        <AuthField
          label="Confirm new password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <AuthSubmit pending={pending} pendingLabel="Saving…">
          Save new password
        </AuthSubmit>
      </form>
    </AuthCard>
  );
}
