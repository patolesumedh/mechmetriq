"use client";

import { useActionState } from "react";
import { updateProfileAction, type ProfileState } from "./actions";
import type { Tables } from "@/lib/types/database";

const initialState: ProfileState = {};
const inputClass =
  "w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand";

export function ProfileForm({ profile }: { profile: Tables<"profiles"> }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <div className="rounded-lg bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-[#a12525]">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="rounded-lg bg-good-bg px-3.5 py-3 text-[13px] font-medium text-[#0a6b0a]">
          Profile updated.
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Email</label>
        <input value={profile.email} disabled className={inputClass + " bg-plane text-muted"} />
      </div>
      <div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
          Full name *
        </label>
        <input name="full_name" defaultValue={profile.full_name} required className={inputClass} />
      </div>
      <div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Phone</label>
        <input name="phone" defaultValue={profile.phone ?? ""} className={inputClass} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-[9px] bg-brand px-5 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
