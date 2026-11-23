"use client";

import { useActionState } from "react";
import Link from "next/link";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { MechOneHubLogo } from "@/components/ui/MechOneHubLogo";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm({ next, notice }: { next?: string | null; notice?: string | null }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-plane px-6">
      <form action={formAction} className="w-full max-w-[400px] rounded-[10px] border border-grid bg-surface p-8">
        {next && <input type="hidden" name="next" value={next} />}
        <Link href="/" className="mb-6 flex w-fit items-center text-lg font-bold transition-opacity hover:opacity-90">
          <MechOneHubLogo markSize={28} />
        </Link>
        <h1 className="mb-1 text-xl font-bold text-ink">Log in</h1>
        <p className="mb-5 text-[13px] text-ink-2">Access your buyer, vendor, or admin dashboard.</p>

        {state.error ? (
          <div className="mb-4 rounded-[6px] bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-crit">
            {state.error}
          </div>
        ) : (
          notice && (
            <div className="mb-4 rounded-[6px] bg-brand-light px-3.5 py-3 text-[13px] font-medium text-ink">
              {notice}
            </div>
          )
        )}

        <div className="mb-3.5">
          <label htmlFor="login-identifier" className="mb-1.5 block text-[12px] font-medium text-muted">
            Email
          </label>
          <input
            id="login-identifier"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.identifier}
            required
            className="h-10 w-full rounded-[6px] border border-grid bg-surface px-3.5 text-[14px] text-ink outline-none focus:border-brand"
          />
        </div>
        <div className="mb-2">
          <label className="mb-1.5 block text-[12px] font-medium text-muted">Password</label>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-10 w-full rounded-[6px] border border-grid bg-surface px-3.5 text-[14px] text-ink outline-none focus:border-brand"
          />
        </div>
        <div className="mb-5 flex justify-between text-[12.5px]">
          <label className="flex items-center gap-1.5 text-ink-2">
            <input type="checkbox" name="rememberMe" /> Remember me
          </label>
          <Link href="/forgot-password" className="font-semibold text-link hover:underline">
            Forgot password?
          </Link>
        </div>
        <TurnstileField action="login" resetSignal={state} />
        <button
          type="submit"
          disabled={pending}
          className="btn btn-primary h-10 w-full rounded-[6px] text-[14px] font-semibold transition-colors duration-120 ease-out"
        >
          {pending ? "Logging in…" : "Log In"}
        </button>
        <div className="mt-4 text-center text-[13px] text-ink-2">
          New here?{" "}
          <Link href="/register" className="font-semibold text-link hover:underline">
            Create an account
          </Link>
        </div>
      </form>
    </div>
  );
}
