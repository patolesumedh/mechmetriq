"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { TurnstileField } from "@/components/auth/TurnstileField";
import { MechOneHubLogo } from "@/components/ui/MechOneHubLogo";
import { PASSWORD_HINT } from "@/lib/auth/validation";
import { registerAction, type RegisterState } from "./actions";

const initialState: RegisterState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);
  const [accountType, setAccountType] = useState<"buyer" | "vendor">("vendor");
  const [vendorType, setVendorType] = useState<"fabrication" | "raw_material" | "both">("fabrication");

  const isVendor = accountType === "vendor";
  const values = state.values ?? {};

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-between bg-[#0D1F3B] p-12 text-[#E7EDF5]">
        <Link href="/" className="flex w-fit items-center text-[19px] font-bold transition-opacity hover:opacity-90">
          <MechOneHubLogo theme="dark" markSize={30} />
        </Link>
        <div>
          <h2 className="mb-3.5 max-w-[380px] text-[28px] font-semibold leading-tight tracking-tight text-white">
            One account. Custom parts made, or raw materials delivered.
          </h2>
          <p className="max-w-[360px] text-sm leading-relaxed text-[#C9D4E3]">
            Join as a buyer to get instant quotes and source materials, or as a vendor to receive
            jobs and sell to verified procurement teams across India.
          </p>
        </div>
        <div className="flex gap-7 text-[12.5px] text-[#93A4BC]">
          <div>
            <b className="block font-mono text-xl font-bold text-white">1,200+</b>
            Vendors
          </div>
          <div>
            <b className="block font-mono text-xl font-bold text-white">40,000+</b>
            Parts quoted
          </div>
          <div>
            <b className="block font-mono text-xl font-bold text-white">4.8/5</b>
            Avg. rating
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-plane p-8 sm:p-12">
        <form action={formAction} className="w-full max-w-[480px] rounded-[10px] border border-grid bg-surface p-8">
          <h1 className="mb-1.5 text-2xl font-bold tracking-tight text-ink">Create your account</h1>
          <p className="mb-6 text-[13.5px] text-ink-2">
            Choose how you&rsquo;ll use MechOneHub &mdash; this decides which fields and dashboard
            you&rsquo;ll get.
          </p>

          {state.error && (
            <div className="mb-4 rounded-[6px] bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-crit">
              {state.error}
            </div>
          )}

          <div className="mb-4.5 flex gap-1.5">
            {(["buyer", "vendor"] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setAccountType(t)}
                className={
                  "flex-1 rounded-[6px] border py-2 text-[13.5px] font-semibold capitalize transition-colors " +
                  (accountType === t
                    ? "border-[#102D52] bg-[#E4ECF6] text-[#102D52]"
                    : "border-grid bg-surface text-ink-2 hover:bg-plane")
                }
              >
                {t}
              </button>
            ))}
          </div>
          <input type="hidden" name="accountType" value={accountType} />

          {isVendor && (
            <>
              <div className="mb-5 grid grid-cols-3 gap-2.5">
                {(
                  [
                    { key: "fabrication", title: "Machining / Fab", desc: "Receive RFQs, submit quotes, produce custom parts." },
                    { key: "raw_material", title: "Raw Material", desc: "List materials, manage stock, fulfil marketplace orders." },
                    { key: "both", title: "Both Portals", desc: "One login for both fabrication and raw material portals." },
                  ] as const
                ).map((opt) => (
                  <button
                    type="button"
                    key={opt.key}
                    onClick={() => setVendorType(opt.key)}
                    className={
                      "rounded-[8px] border p-3 text-left transition-colors " +
                      (vendorType === opt.key
                        ? "border-[#102D52] bg-[#E4ECF6] text-[#102D52]"
                        : "border-grid bg-surface text-ink-2 hover:bg-plane")
                    }
                  >
                    <b className="mb-1 block text-[13px] text-ink">{opt.title}</b>
                    <span className="text-[11.5px] leading-snug text-ink-2">{opt.desc}</span>
                  </button>
                ))}
              </div>
              <input type="hidden" name="vendorType" value={vendorType} />
              <div className="mb-5 flex gap-2.5 rounded-[6px] border border-grid bg-raised p-3.5 text-[12.5px] leading-relaxed text-ink-2">
                Selecting a vendor type customises the fields below &mdash; Fabrication
                vendors set process capabilities during KYC; Raw Material suppliers set materials
                handled and warehouse details instead.
              </div>
            </>
          )}

          <Field label="Full name" name="fullName" required placeholder="e.g. Vivaansh Rathod" defaultValue={values.fullName} />
          {isVendor && (
            <Field
              label="Company name"
              name="companyName"
              required
              placeholder="e.g. Precision Fab Works"
              hint="Required for vendor accounts"
              defaultValue={values.companyName}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" name="email" type="email" required placeholder="you@company.com" defaultValue={values.email} />
            <Field
              label="Mobile number"
              name="phone"
              type="tel"
              required
              placeholder="10-digit mobile"
              defaultValue={values.phone}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Password" name="password" type="password" required placeholder="Min. 8 characters" />
            <Field label="Confirm password" name="confirmPassword" type="password" required placeholder="Re-enter password" />
          </div>
          <div className="-mt-1.5 mb-3.5 text-[11.5px] text-muted">{PASSWORD_HINT}</div>
          {isVendor && (
            <Field
              label="GST number"
              name="gstin"
              required
              placeholder="15-character GSTIN"
              hint="Required for vendor accounts"
              defaultValue={values.gstin}
            />
          )}

          <label className="my-4.5 flex items-start gap-2 text-[12.5px] text-ink-2">
            <input type="checkbox" name="agreeTerms" required className="mt-0.5" />
            <span>I agree to the Terms of Service and Privacy Policy.</span>
          </label>

          <TurnstileField action="register" resetSignal={state} />

          <button
            type="submit"
            disabled={pending}
            className="btn btn-primary h-12 w-full rounded-[6px] text-center text-[14.5px] font-semibold transition-colors duration-120 ease-out"
          >
            {pending ? "Creating account…" : `Create ${isVendor ? "Vendor" : "Buyer"} Account →`}
          </button>
          <div className="mt-4.5 text-center text-[13px] text-ink-2">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-link hover:underline">
              Log in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  hint,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  defaultValue?: string;
}) {
  return (
    <div className="mb-3.5">
      <label className="mb-1.5 block text-[12px] font-medium text-muted">
        {label} {required && <span className="text-crit">*</span>}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="h-10 w-full rounded-[6px] border border-grid bg-surface px-3.5 text-[14px] text-ink outline-none focus:border-brand"
      />
      {hint && <div className="mt-1 text-[11.5px] text-muted">{hint}</div>}
    </div>
  );
}
