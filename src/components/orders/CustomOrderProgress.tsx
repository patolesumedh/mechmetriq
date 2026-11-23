import { cn } from "@/lib/cn";

const STEPS = [
  { key: "accepted_paid", label: "Paid" },
  { key: "in_production", label: "In production" },
  { key: "qc_ready", label: "Quality check" },
  { key: "shipped", label: "Dispatched" },
  { key: "completed", label: "Completed" },
] as const;

function stepIndex(status: string) {
  switch (status) {
    case "accepted_paid":
      return 0;
    case "in_production":
      return 1;
    case "qc_ready":
      return 2;
    case "shipped":
    case "delivered":
      return 3;
    case "completed":
      return 4;
    default:
      return -1;
  }
}

/** Five-step tracker for a custom-part order. Hidden for cancelled / refunded / disputed orders. */
export function CustomOrderProgress({ status }: { status: string }) {
  const current = stepIndex(status);
  if (current < 0) return null;
  return (
    <ol className="flex items-start">
      {STEPS.map((s, i) => {
        const done = i < current || (i === current && s.key === "completed");
        const active = i === current && !done;
        return (
          <li key={s.key} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span
                className={cn(
                  "absolute right-1/2 top-3 h-[3px] w-full -translate-y-1/2",
                  i <= current ? "bg-good" : "bg-grid"
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                "relative z-10 grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold",
                done ? "bg-good text-white" : active ? "bg-brand text-white ring-4 ring-brand-light" : "bg-grid text-muted"
              )}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={cn(
                "mt-1.5 text-[11.5px]",
                active ? "font-bold text-ink" : done ? "font-semibold text-ink-2" : "text-muted"
              )}
            >
              {s.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
