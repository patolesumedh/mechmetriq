"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export interface NavItem {
  label: string;
  href: string;
  count?: number;
}

export function Sidebar({
  logoLabel,
  sectionLabel,
  items,
  footer,
}: {
  logoLabel?: string;
  sectionLabel: string;
  items: NavItem[];
  footer: { initials: string; name: string; subtitle: string };
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[236px] flex-none flex-col border-r border-grid bg-surface p-3.5">
      <Link href="/" className="mb-1 flex items-center gap-2 px-2 pb-4 pt-1.5 text-[17px] font-bold tracking-tight">
        <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-[7px] bg-linear-to-br from-brand to-brand-dark text-[13px] font-extrabold text-white">
          M
        </span>
        {logoLabel ?? "MECHmetrIQ"}
      </Link>
      <div className="px-2.5 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {sectionLabel}
      </div>
      <nav className="flex flex-col gap-px">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-ink-2 hover:bg-plane",
                active && "bg-brand-light font-bold text-brand-dark hover:bg-brand-light"
              )}
            >
              <span>{item.label}</span>
              {typeof item.count === "number" && (
                <span className="rounded-full bg-accent-orange px-[7px] py-px text-[10.5px] font-extrabold text-white">
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 border-t border-grid pt-3.5">
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-light text-[12.5px] font-bold text-brand-dark">
          {footer.initials}
        </div>
        <div>
          <b className="block text-[13px]">{footer.name}</b>
          <span className="text-[11.5px] text-muted">{footer.subtitle}</span>
        </div>
      </div>
    </aside>
  );
}
