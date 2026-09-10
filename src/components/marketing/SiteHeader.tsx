"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";

const NAV_LINKS = [
  { label: "How It Works", href: "/how-it-works" },
  { label: "Services", href: "/services" },
  { label: "Marketplace", href: "/#marketplace" },
  { label: "Pricing", href: "/pricing" },
  { label: "For Vendors", href: "/for-vendors" },
  { label: "About", href: "/about" },
];

/**
 * Resolves the signed-in visitor's dashboard path (or null if signed out).
 * The marketing site is otherwise fully static/public, so this is a
 * client-side check — it lets the header offer a direct way back into the
 * dashboard instead of a stale "Log In" / "Get Started" pair that makes an
 * already-authenticated visitor think they've been signed out.
 */
function useDashboardHref() {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function resolve() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;
      if (!user) {
        setHref(null);
        return;
      }

      const path = await getDashboardPath(supabase, user.id);
      if (!active) return;
      setHref(path);
    }

    resolve();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => resolve());
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return href;
}

export function SiteHeader() {
  const pathname = usePathname();
  const dashboardHref = useDashboardHref();

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
          {dashboardHref ? (
            <ButtonLink href={dashboardHref}>Go to Dashboard &rarr;</ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="outline">
                Log In
              </ButtonLink>
              <ButtonLink href="/register">Get Started</ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
