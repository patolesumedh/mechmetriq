"use client";

export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-grid bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink hover:bg-plane print:hidden"
    >
      {label}
    </button>
  );
}
