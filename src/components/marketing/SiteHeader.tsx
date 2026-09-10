"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const NAV_LINKS = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Services", href: "/services" },
  { label: "Marketplace", href: "/#marketplace" },
  { label: "Pricing", href: "/pricing" },
  { label: "For Vendors", href: "/for-vendors" },
  { label: "About", href: "/about" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-grid bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-8 py-4">
        <div>
          <Link href="/" className="flex items-center gap-2 text-[19px] font-bold tracking-tight">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-linear-to-br from-brand to-brand-dark text-[15px] font-extrabold text-white">
              M
            </span>
            MECHmetrIQ
          </Link>
          <div className="ml-[38px] mt-px text-[10px] font-semibold uppercase tracking-wide text-muted">
            Mechanical Intelligence. Smarter Quotations.
          </div>
        </div>
        <nav className="flex gap-7 text-sm text-ink-2">
          {NAV_LINKS.map((link) => {
            const active = link.href !== "/#marketplace" && pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn("transition-colors hover:text-ink", active && "font-semibold text-ink")}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2.5">
          <ButtonLink href="/login" variant="outline">
            Log In
          </ButtonLink>
          <ButtonLink href="/register">Get Started</ButtonLink>
        </div>
      </div>
    </header>
  );
}
