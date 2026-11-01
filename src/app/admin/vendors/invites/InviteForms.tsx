"use client";

import { useActionState, useState } from "react";
import { createInviteAction, resendInviteAction, type InviteState } from "./actions";

const input =
  "w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand";
const label = "mb-1.5 block text-[12.5px] font-semibold text-ink-2";

/** The one-time link, with copy and an email draft (no mail server needed). */
function LinkBox({ state }: { state: InviteState }) {
  const [copied, setCopied] = useState(false);
  if (!state.link) return null;
  const subject = "You're invited to join MECHmetrIQ as a vendor";
  const body = `Hello,\n\nMECHmetrIQ has invited ${state.company ?? "your company"} to register as a vendor.\n\nComplete your registration here (the link works for 72 hours and only once):\n${state.link}\n\nAfter registering you'll verify your email and complete KYC.\n\nRegards,\nMECHmetrIQ`;
  return (
    <div className="mt-4 rounded-lg border border-[#bfe3bf] bg-good-bg p-4 text-[13px] text-[#0a6b0a]">
      <b>Invitation link for {state.email}</b> — copy it now; for security it isn&rsquo;t shown again (use Resend
      for a new one).
      <div className="mt-2 flex gap-2">
        <input readOnly value={state.link} className={input + " bg-white font-mono text-[12px] text-ink"} />
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(state.link!);
            setCopied(true);
          }}
          className="whitespace-nowrap rounded-lg bg-brand px-3.5 text-[12.5px] font-bold text-white"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <a
        href={`mailto:${state.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
        className="mt-2 inline-block font-semibold underline"
      >
        Open an email draft to {state.email} &rarr;
      </a>
    </div>
  );
}

export function NewInviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(createInviteAction, {});
  return (
    <form action={action}>
      <div className="mb-3.5 grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Vendor type *</label>
          <select name="vendor_type" defaultValue="fabrication" className={input}>
            <option value="fabrication">Fabrication / machining</option>
            <option value="raw_material">Raw material supplier</option>
            <option value="both">Both (switch between portals)</option>
          </select>
        </div>
        <div>
          <label className={label}>Company name *</label>
          <input name="company_name" required maxLength={200} className={input} />
        </div>
      </div>
      <div className="mb-3.5 grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Contact name *</label>
          <input name="contact_name" required maxLength={120} className={input} />
        </div>
        <div>
          <label className={label}>Email *</label>
          <input name="email" type="email" required maxLength={200} className={input} />
          <p className="mt-1 text-[11.5px] text-muted">The vendor can&rsquo;t change this email when registering.</p>
        </div>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Mobile (optional)</label>
          <input name="phone" inputMode="tel" maxLength={14} className={input} />
        </div>
        <div>
          <label className={label}>GSTIN (optional, recommended)</label>
          <input name="gstin" maxLength={15} className={input + " uppercase"} />
        </div>
      </div>
      {state.error && (
        <div className="mb-3 rounded-lg bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-[#a12525]">{state.error}</div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create invitation"}
      </button>
      <LinkBox state={state} />
    </form>
  );
}

export function ResendButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(resendInviteAction, {});
  return (
    <div>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" disabled={pending} className="text-[12.5px] font-semibold text-brand disabled:opacity-60">
          {pending ? "Resending…" : "Resend"}
        </button>
      </form>
      {state.error && <p className="mt-1 text-[12px] text-crit">{state.error}</p>}
      <LinkBox state={state} />
    </div>
  );
}
