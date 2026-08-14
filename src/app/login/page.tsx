"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-plane px-6">
      <form action={formAction} className="w-full max-w-[400px] rounded-2xl border border-grid bg-surface p-8">
        <div className="mb-6 flex items-center gap-2 text-lg font-bold">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-linear-to-br from-brand to-brand-dark text-sm font-extrabold text-white">
            M
          </span>
          MECHmetrIQ
        </div>
        <h1 className="mb-1 text-xl font-bold">Log in</h1>
        <p className="mb-5 text-[13px] text-ink-2">Access your buyer, vendor, or admin dashboard.</p>

        {state.error && (
          <div className="mb-4 rounded-lg bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-[#a12525]">
            {state.error}
          </div>
        )}

        <div className="mb-3.5">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Email or mobile</label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand"
          />
        </div>
        <div className="mb-2">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Password</label>
          <input
            name="password"
            type="password"
            required
            className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand"
          />
        </div>
        <div className="mb-5 flex justify-between text-[12.5px]">
          <label className="flex items-center gap-1.5 text-ink-2">
            <input type="checkbox" name="rememberMe" /> Remember me
          </label>
          <Link href="/forgot-password" className="font-semibold text-brand">
            Forgot password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-[9px] bg-brand py-3 text-[14.5px] font-bold text-white disabled:opacity-60"
        >
          {pending ? "Logging in…" : "Log In"}
        </button>
        <div className="mt-4 text-center text-[13px] text-ink-2">
          New here?{" "}
          <Link href="/register" className="font-bold text-brand">
            Create an account
          </Link>
        </div>
      </form>
    </div>
  );
}
