import { cn } from "@/lib/cn";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-[10px] border border-grid bg-surface", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
}: {
  title: string;
  action?: { label: string; href?: string };
}) {
  return (
    <div className="flex items-center justify-between border-b border-grid px-5 py-4">
      <h3 className="text-[14.5px] font-semibold">{title}</h3>
      {action && (
        <a href={action.href ?? "#"} className="text-[12.5px] font-semibold text-brand">
          {action.label} &rarr;
        </a>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  deltaTone = "good",
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "good" | "warn" | "neutral";
}) {
  const deltaColor =
    deltaTone === "good" ? "text-good" : deltaTone === "warn" ? "text-[#a15c00]" : "text-muted";
  return (
    <Card className="p-[18px_20px]">
      <div className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="text-[26px] font-extrabold tracking-tight">{value}</div>
      {delta && <div className={cn("mt-1.5 text-xs font-semibold", deltaColor)}>{delta}</div>}
    </Card>
  );
}
