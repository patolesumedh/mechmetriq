import { cn } from "@/lib/cn";

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "border-b border-grid px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  strong,
  className,
}: {
  children: React.ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border-b border-grid px-5 py-3 align-middle text-[13px] [tr:last-child_&]:border-b-0",
        strong ? "font-semibold text-ink" : "text-ink-2",
        className
      )}
    >
      {children}
    </td>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-8 text-center text-[13px] text-muted">
        {children}
      </td>
    </tr>
  );
}
