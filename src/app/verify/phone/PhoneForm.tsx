"use client";

import { useActionState } from "react";
import { AuthError, AuthField, AuthNotice, AuthSubmit } from "@/components/auth/AuthCard";
import { phoneVerificationAction, type PhoneState } from "./actions";

export function PhoneForm({ phone }: { phone: string }) {
  const [state, formAction, pending] = useActionState<PhoneState, FormData>(phoneVerificationAction, {
    stage: "enter",
    phone,
  });

  if (state.stage === "code") {
    return (
      <>
        {state.error ? <AuthError>{state.error}</AuthError> : state.notice && <AuthNotice>{state.notice}</AuthNotice>}
        <form action={formAction}>
          <input type="hidden" name="intent" value="verify" />
          <AuthField
            label="Verification code"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="6-digit code"
            autoFocus
            required
          />
          <AuthSubmit pending={pending} pendingLabel="Verifying…">
            Verify mobile
          </AuthSubmit>
        </form>
        <div className="mt-4 flex justify-between text-[12.5px]">
          <form action={formAction}>
            <input type="hidden" name="intent" value="change" />
            <button type="submit" className="font-semibold text-brand">
              Change number
            </button>
          </form>
          <form action={formAction}>
            <input type="hidden" name="intent" value="send" />
            <input type="hidden" name="phone" value={state.phone ?? ""} />
            <button type="submit" disabled={pending} className="font-semibold text-brand disabled:opacity-60">
              Resend code
            </button>
          </form>
        </div>
      </>
    );
  }

  return (
    <form action={formAction}>
      {state.error && <AuthError>{state.error}</AuthError>}
      <input type="hidden" name="intent" value="send" />
      <AuthField
        label="Mobile number"
        name="phone"
        type="tel"
        autoComplete="tel-national"
        placeholder="10-digit mobile"
        defaultValue={state.phone}
        required
      />
      <AuthSubmit pending={pending} pendingLabel="Sending code…">
        Send code
      </AuthSubmit>
    </form>
  );
}
