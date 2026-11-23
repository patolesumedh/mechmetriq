"use client";

import { useActionState } from "react";
import { submitKycAction, type SubmitState } from "@/lib/kyc/submit";
import { DECLARATIONS } from "@/lib/kyc/status";

export function SubmitForm({ resubmit }: { resubmit: boolean }) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitKycAction, {});
  return (
    <form action={action} className="space-y-3">
      {DECLARATIONS.map((d, i) => (
        <label key={i} className="flex items-start gap-2.5 text-[13px] text-ink">
          <input type="checkbox" name={`declaration_${i}`} value="yes" className="mt-0.5 h-4 w-4 flex-none" />
          <span>{d}</span>
        </label>
      ))}
      {state.error && (
        <div className="rounded-lg bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-[#a12525]">{state.error}</div>
      )}
      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-brand px-5 py-3 text-[14.5px] font-bold text-white disabled:opacity-60"
        >
          {pending ? "Submitting…" : resubmit ? "Resubmit application →" : "Submit application →"}
        </button>
      </div>
    </form>
  );
}
