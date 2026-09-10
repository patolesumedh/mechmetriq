"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { registerAction, type RegisterState } from "./actions";

const initialState: RegisterState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);
  const [accountType, setAccountType] = useState<"buyer" | "vendor">("vendor");
  const [vendorType, setVendorType] = useState<"fabrication" | "raw_material">("fabrication");

  const isVendor = accountType === "vendor";

  return (
    <div className="grid min-h-screen grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-between bg-linear-to-br from-[#12335c] via-brand-dark to-brand p-12 text-white">
        <Link href="/" className="flex w-fit items-center gap-2.5 text-[19px] font-bold transition-opacity hover:opacity-90">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-white/15 text-[15px] font-extrabold">
            M
          </span>
          MECHmetrIQ
        </Link>
        <div>
          <h2 className="mb-3.5 max-w-[380px] text-[28px] leading-tight tracking-tight">
            One account. Custom parts made, or raw materials delivered.
          </h2>
          <p className="max-w-[360px] text-sm leading-relaxed text-[#cfe0f5]">
            Join as a buyer to get instant quotes and source materials, or as a vendor to receive
            jobs and sell to verified procurement teams across India.
          </p>
        </div>
        <div className="flex gap-7 text-[12.5px] text-[#cfe0f5]">
          <div>
            <b className="block text-xl font-extrabold text-white">1,200+</b>
            Vendors
          </div>
          <div>
            <b className="block text-xl font-extrabold text-white">40,000+</b>
            Parts quoted
          </div>
          <div>
            <b className="block text-xl font-extrabold text-white">4.8/5</b>
            Avg. rating
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-12">
        <form action={formAction} className="w-full max-w-[480px]">
          <h1 className="mb-1.5 text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="mb-6 text-[13.5px] text-ink-2">
            Choose how you&rsquo;ll use MECHmetrIQ &mdash; this decides which fields and dashboard
            you&rsquo;ll get.
          </p>

          {state.error && (
            <div className="mb-4 rounded-lg bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-[#a12525]">
              {state.error}
            </div>
          )}

          <div className="mb-4.5 flex rounded-[10px] border border-grid bg-plane p-1">
            {(["buyer", "vendor"] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setAccountType(t)}
                className={
                  "flex-1 rounded-lg py-2 text-[13.5px] font-bold capitalize " +
                  (accountType === t ? "bg-surface text-ink shadow-sm" : "text-ink-2")
                }
              >
                {t}
              </button>
            ))}
          </div>
          <input type="hidden" name="accountType" value={accountType} />

          {isVendor && (
            <>
              <div className="mb-5 grid grid-cols-2 gap-3">
                {(
                  [
                    { key: "fabrication", icon: "⚙️", title: "Machining / Fabrication", desc: "Receive RFQs, submit quotes, produce custom parts." },
                    { key: "raw_material", icon: "🧱", title: "Raw Material Supplier", desc: "List materials, manage stock, fulfil marketplace orders." },
                  ] as const
                ).map((opt) => (
                  <button
                    type="button"
                    key={opt.key}
                    onClick={() => setVendorType(opt.key)}
                    className={
                      "rounded-[10px] border-[1.5px] p-3.5 text-left " +
                      (vendorType === opt.key
                        ? "border-brand bg-brand-light"
                        : "border-grid")
                    }
                  >
                    <div className="mb-2 text-lg">{opt.icon}</div>
                    <b className="mb-0.5 block text-[13.5px]">{opt.title}</b>
                    <span className="text-[11.5px] leading-snug text-ink-2">{opt.desc}</span>
                  </button>
                ))}
              </div>
              <input type="hidden" name="vendorType" value={vendorType} />
              <div className="mb-5 flex gap-2.5 rounded-lg bg-brand-light p-3.5 text-[12.5px] leading-relaxed text-brand-dark">
                &#9432; Selecting a vendor type customises the fields below &mdash; Fabrication
                vendors set process capabilities during KYC; Raw Material suppliers set materials
                handled and warehouse details instead.
              </div>
            </>
          )}

          <Field label="Full name" name="fullName" required placeholder="e.g. Sana Mirza" />
          {isVendor && (
            <Field
              label="Company name"
              name="companyName"
              required
              placeholder="e.g. Precision Fab Works"
              hint="Required for vendor accounts"
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" name="email" type="email" required placeholder="you@company.com" />
            <Field label="Mobile number" name="phone" required placeholder="10-digit mobile" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Password" name="password" type="password" required placeholder="Min. 8 characters" />
            <Field label="Confirm password" name="confirmPassword" type="password" required placeholder="Re-enter password" />
          </div>
          {isVendor && (
            <Field
              label="GST number"
              name="gstin"
              required
              placeholder="15-character GSTIN"
              hint="Required for vendor accounts"
            />
          )}

          <label className="my-4.5 flex items-start gap-2 text-[12.5px] text-ink-2">
            <input type="checkbox" name="agreeTerms" defaultChecked className="mt-0.5" />
            <span>I agree to the Terms of Service and Privacy Policy.</span>
          </label>

          <button
            type="submit"
            disabled={pending}
            className="block w-full rounded-[9px] bg-brand py-3.5 text-center text-[14.5px] font-bold text-white disabled:opacity-60"
          >
            {pending ? "Creating account…" : `Create ${isVendor ? "Vendor" : "Buyer"} Account →`}
          </button>
          <div className="mt-4.5 text-center text-[13px] text-ink-2">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-brand">
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
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="mb-3.5">
      <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
        {label} {required && <span className="text-crit">*</span>}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand"
      />
      {hint && <div className="mt-1 text-[11.5px] text-muted">{hint}</div>}
    </div>
  );
}
