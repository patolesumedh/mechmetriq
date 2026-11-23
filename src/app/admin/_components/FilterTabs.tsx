import Link from "next/link";
import { cn } from "@/lib/cn";

export interface FilterTab {
  label: string;
  value: string | undefined;
}

/**
 * Renders a row of query-param-driven filter tabs, e.g. All / Buyer / Vendor / Admin.
 * `paramName` is the searchParams key; `value: undefined` represents "All".
 */
export function FilterTabs({
  basePath,
  paramName,
  active,
  tabs,
}: {
  basePath: string;
  paramName: string;
  active: string | undefined;
  tabs: FilterTab[];
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 rounded-[10px] border border-grid bg-surface p-1">
      {tabs.map((tab) => {
        const isActive = active === tab.value;
        const href = tab.value ? `${basePath}?${paramName}=${tab.value}` : basePath;
        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "rounded-lg px-3.5 py-2 text-[12.5px] font-bold",
              isActive ? "bg-brand-light text-brand-dark" : "text-ink-2 hover:bg-plane"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
