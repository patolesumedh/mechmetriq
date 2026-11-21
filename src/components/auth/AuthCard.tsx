import Link from "next/link";
import { MechOneHubLogo } from "@/components/ui/MechOneHubLogo";

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
        className="w-full rounded-[10px] border border-grid bg-surface p-8"
        style={{ maxWidth: width }}
      >
        <Link href="/" className="mb-6 flex w-fit items-center text-lg font-bold transition-opacity hover:opacity-90">
          <MechOneHubLogo markSize={28} />
        </Link>
        <h1 className="mb-1 text-xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="mb-5 text-[13px] leading-relaxed text-ink-2">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="mb-4 rounded-[6px] bg-crit-bg px-3.5 py-3 text-[13px] font-medium text-crit">
      {children}
    </div>
  );
}

export function AuthNotice({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="mb-4 rounded-[6px] bg-brand-light px-3.5 py-3 text-[13px] font-medium text-ink">
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
      <label htmlFor={input.id ?? input.name} className="mb-1.5 block text-[12px] font-medium text-muted">
        {label}
      </label>
      <input
        id={input.id ?? input.name}
        {...input}
        className="h-10 w-full rounded-[6px] border border-grid bg-surface px-3.5 text-[14px] text-ink outline-none focus:border-brand"
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
      className="btn btn-primary h-10 w-full rounded-[6px] text-[14px] font-semibold transition-colors duration-120 ease-out"
    >
      {pending ? (pendingLabel ?? "Please wait…") : children}
    </button>
  );
}
