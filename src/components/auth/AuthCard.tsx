import Link from "next/link";

/** Centered card shell used by login and the other auth screens. */
export function AuthCard({
  title,
  subtitle,
  children,
  width = 400,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-plane px-6">
      <div
        className="w-full rounded-2xl border border-grid bg-surface p-8"
        style={{ maxWidth: width }}
      >
        <Link href="/" className="mb-6 flex w-fit items-center gap-2 text-lg font-bold transition-opacity hover:opacity-90">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-linear-to-br from-brand to-brand-dark text-sm font-extrabold text-white">
            M
          </span>
          MECHmetrIQ
        </Link>
        <h1 className="mb-1 text-xl font-bold">{title}</h1>
        {subtitle && <p className="mb-5 text-[13px] leading-relaxed text-ink-2">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="mb-4 rounded-lg bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-[#a12525]">
      {children}
    </div>
  );
}

export function AuthNotice({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="mb-4 rounded-lg bg-brand-light px-3.5 py-3 text-[13px] font-medium text-brand-dark">
      {children}
    </div>
  );
}

export function AuthField({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mb-3.5">
      <label htmlFor={input.id ?? input.name} className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
        {label}
      </label>
      <input
        id={input.id ?? input.name}
        {...input}
        className="w-full rounded-lg border border-grid px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand"
      />
      {hint && <div className="mt-1 text-[11.5px] text-muted">{hint}</div>}
    </div>
  );
}

export function AuthSubmit({ pending, children, pendingLabel }: { pending?: boolean; children: React.ReactNode; pendingLabel?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-[9px] bg-brand py-3 text-[14.5px] font-bold text-white disabled:opacity-60"
    >
      {pending ? (pendingLabel ?? "Please wait…") : children}
    </button>
  );
}
