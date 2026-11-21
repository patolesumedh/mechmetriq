"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { logoutAction } from "@/lib/actions/auth";
import { MechOneHubLogo } from "@/components/ui/MechOneHubLogo";

export interface NavItem {
  label: string;
  href: string;
  count?: number;
  /** Shows a "Soon" tag for parked features. */
  soon?: boolean;
  /** Extra path prefixes (besides href) that should also light up this item, e.g. a merged nav entry covering two routes. */
  matchPrefixes?: string[];
}

export function Sidebar({
  logoLabel,
  sectionLabel,
  items,
  footer,
  switcher,
}: {
  logoLabel?: string;
  sectionLabel: string;
  items: NavItem[];
  /** Link to another portal of the same account (vendors of type "both"). */
  switcher?: { label: string; href: string };
  footer: { initials: string; name: string; subtitle: string };
}) {
  const pathname = usePathname();

  const matchLength = (item: NavItem) => {
    const matches = (href: string) => pathname === href || pathname.startsWith(href + "/");
    const hrefs = [item.href, ...(item.matchPrefixes ?? [])].filter(matches);
    return hrefs.length ? Math.max(...hrefs.map((h) => h.length)) : -1;
  };
  const best = Math.max(-1, ...items.map(matchLength));
  const activeHref = best >= 0 ? items.find((i) => matchLength(i) === best)?.href : undefined;

  return (
    <aside className="flex w-[236px] flex-none flex-col border-r border-grid bg-surface p-3.5 print:hidden">
      <Link href="/" className="mb-1 flex items-center px-2 pb-4 pt-1.5 text-[17px] font-bold tracking-tight">
        <MechOneHubLogo markSize={26} suffix={logoLabel} />
      </Link>
      {switcher && (
        <Link
          href={switcher.href}
          className="mb-1 flex items-center justify-between rounded-[6px] border border-grid px-2.5 py-2 text-[12.5px] font-semibold text-ink hover:bg-brand-light"
        >
          <span>{switcher.label}</span>
          <span aria-hidden>&#8644;</span>
        </Link>
      )}
      <div className="px-2.5 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {sectionLabel}
      </div>
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between gap-2.5 rounded-[6px] px-2.5 py-2 text-[13.5px] font-medium text-ink-2 transition-colors hover:bg-plane",
                active && "border border-[#102D52] bg-[#E4ECF6] font-semibold text-[#102D52] hover:bg-[#E4ECF6]"
              )}
            >
              <span>{item.label}</span>
              {item.soon && (
                <span className="rounded-full bg-raised px-[7px] py-px text-[10.5px] font-semibold text-muted">
                  Soon
                </span>
              )}
              {typeof item.count === "number" && (
                <span className="rounded-full bg-[#FF7900] px-[7px] py-px font-mono text-[11px] font-bold text-[#0B2140]">
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 border-t border-grid pt-3.5">
        <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-light text-[12.5px] font-bold text-ink">
          {footer.initials}
        </div>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[13px] text-ink">{footer.name}</b>
          <span className="block truncate text-[11.5px] text-muted">{footer.subtitle}</span>
        </div>
        <Link
          href="/account/security"
          title="Account security"
          aria-label="Account security"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[6px] text-muted transition-colors hover:bg-plane hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            title="Log out"
            aria-label="Log out"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-[6px] text-muted transition-colors hover:bg-crit-bg hover:text-crit"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </form>
      </div>
    </aside>
  );
}
