"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { MechOneHubLogo } from "@/components/ui/MechOneHubLogo";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";

const NAV_LINKS = [
  { label: "AI CAD Designer", href: "/ai-cad" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Services", href: "/services" },
  { label: "Marketplace", href: "/raw-materials" },
  { label: "Pricing", href: "/pricing" },
  { label: "For Vendors", href: "/for-vendors" },
  { label: "About", href: "/about" },
];

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
    <header className="sticky top-0 z-10 border-b border-grid bg-surface">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-3.5 sm:px-8">
        <div>
          <Link href="/" className="flex items-center">
            <MechOneHubLogo markSize={30} />
          </Link>
        </div>
        <nav className="hidden items-center gap-7 text-[14px] md:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "border-b-2 py-1 transition-colors",
                  active
                    ? "border-[#FF7900] font-semibold text-[#102D52]"
                    : "border-transparent text-[#56677E] hover:text-[#102D52]"
                )}
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
