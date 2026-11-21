import Link from "next/link";
import { MechOneHubLogo } from "@/components/ui/MechOneHubLogo";

const COLUMNS: [string, { label: string; href: string }[]][] = [
  [
    "Platform",
    [
      { label: "AI CAD Designer", href: "/ai-cad" },
      { label: "Instant Quote", href: "/register?intent=quote" },
      { label: "Raw Material Marketplace", href: "/raw-materials" },
      { label: "Weight Calculator", href: "/raw-materials/weight-calculator" },
      { label: "Pricing", href: "/pricing" },
      { label: "For Vendors", href: "/for-vendors" },
    ],
  ],
  [
    "Company",
    [
      { label: "About", href: "/about" },
      { label: "How It Works", href: "/how-it-works" },
      { label: "Services", href: "/services" },
      { label: "Contact", href: "/about#contact" },
    ],
  ],
  [
    "Legal",
    [
      { label: "Terms", href: "/legal/terms" },
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Refund Policy", href: "/legal/refund-policy" },
      { label: "Shipping Policy", href: "/legal/shipping-policy" },
    ],
  ],
];

export function SiteFooter() {
  return (
    <footer className="border-t border-grid bg-surface px-8 pb-6 pt-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center text-[19px] font-bold">
              <MechOneHubLogo markSize={28} />
            </Link>
            <p className="mt-3 max-w-[260px] text-[13px] leading-relaxed text-ink-2">
              Custom manufacturing and raw materials, sourced and delivered from one platform.
            </p>
          </div>
          {COLUMNS.map(([heading, links]) => (
            <div key={heading}>
              <h4 className="mb-3.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
                {heading}
              </h4>
              {links.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="mb-2.5 block text-[13.5px] text-ink-2 hover:text-ink"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-grid pt-5 text-[12.5px] text-muted">
          <span>&copy; 2026 MechOneHub. All rights reserved.</span>
          <span>Made for makers, vendors &amp; procurement teams across India.</span>
        </div>
      </div>
    </footer>
  );
}
