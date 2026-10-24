export const inputClass =
  "w-full rounded-lg border border-grid px-3 py-2 text-[13px] outline-none focus:border-brand disabled:bg-plane disabled:text-muted";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "good" | "bad"; children: React.ReactNode }) {
  return (
    <div
      className={
        "mb-4 rounded-lg px-3.5 py-3 text-[13px] font-medium " +
        (tone === "bad" ? "bg-crit-bg text-[#a12525]" : "bg-good-bg text-[#0a6b0a]")
      }
    >
      {children}
    </div>
  );
}
