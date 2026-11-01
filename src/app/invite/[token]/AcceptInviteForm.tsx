"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PASSWORD_HINT } from "@/lib/auth/validation";
import { AuthError } from "@/components/auth/AuthCard";
import { acceptInviteAction, type AcceptState } from "./actions";

const input = "w-full rounded-[9px] border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand";
const label = "mb-1.5 block text-[12.5px] font-semibold text-ink-2";

export function AcceptInviteForm({
  token,
  invite,
}: {
  token: string;
  invite: { email: string; contact_name: string; company_name: string; phone: string | null; gstin: string | null };
}) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptInviteAction, {});
  const v = state.values ?? {};
  return (
    <form action={action}>
      {state.error && <AuthError>{state.error}</AuthError>}
      <input type="hidden" name="token" value={token} />
      <div className="mb-3.5">
        <label className={label}>Email</label>
        <input value={invite.email} readOnly disabled className={input + " bg-plane text-ink-2"} />
        <p className="mt-1 text-[11.5px] text-muted">Invitations can&rsquo;t be moved to another email.</p>
      </div>
      <div className="mb-3.5 grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Full name *</label>
          <input name="fullName" required maxLength={120} defaultValue={v.fullName ?? invite.contact_name} className={input} />
        </div>
        <div>
          <label className={label}>Mobile number *</label>
          <input name="phone" type="tel" required placeholder="10-digit mobile" defaultValue={v.phone ?? invite.phone ?? ""} className={input} />
        </div>
      </div>
      <div className="mb-3.5 grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Company name *</label>
          <input name="companyName" required maxLength={200} defaultValue={v.companyName ?? invite.company_name} className={input} />
        </div>
        <div>
          <label className={label}>GST number *</label>
          <input name="gstin" required maxLength={15} placeholder="15-character GSTIN" defaultValue={v.gstin ?? invite.gstin ?? ""} className={input + " uppercase"} />
        </div>
      </div>
      <div className="mb-1.5 grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Password *</label>
          <input name="password" type="password" required className={input} />
        </div>
        <div>
          <label className={label}>Confirm password *</label>
          <input name="confirmPassword" type="password" required className={input} />
        </div>
      </div>
      <div className="mb-3.5 text-[11.5px] text-muted">{PASSWORD_HINT}</div>
      <label className="my-4 flex items-start gap-2 text-[12.5px] text-ink-2">
        <input type="checkbox" name="agreeTerms" required className="mt-0.5" />
        <span>I agree to the Terms of Service and Privacy Policy.</span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="block w-full rounded-[9px] bg-brand py-3.5 text-center text-[14.5px] font-bold text-white disabled:opacity-60"
      >
        {pending ? "Creating account…" : "Accept invitation & create account →"}
      </button>
      <div className="mt-4 text-center text-[13px] text-ink-2">
        Already registered?{" "}
        <Link href="/login" className="font-bold text-brand">
          Log in
        </Link>
      </div>
    </form>
  );
}
