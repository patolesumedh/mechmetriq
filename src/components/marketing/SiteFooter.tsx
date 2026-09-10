import Link from "next/link";

const COLUMNS: [string, { label: string; href: string }[]][] = [
  [
    "Platform",
    [
      { label: "Instant Quote", href: "/register?intent=quote" },
      { label: "Marketplace", href: "/#marketplace" },
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
      { label: "Terms", href: "#" },
      { label: "Privacy", href: "#" },
      { label: "Refund Policy", href: "#" },
      { label: "Shipping Policy", href: "#" },
    ],
  ],
];

export function SiteFooter() {
  return (
    <footer className="border-t border-grid bg-plane px-8 pb-6 pt-12">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-8 grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-8">
          <div>
            <Link href="/" className="flex items-center gap-2 text-[19px] font-bold">
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-linear-to-br from-brand to-brand-dark text-[15px] font-extrabold text-white">
                M
              </span>
              MECHmetrIQ
            </Link>
            <p className="mt-3 max-w-[260px] text-[13px] leading-relaxed text-ink-2">
              Custom manufacturing and raw materials, sourced and delivered from one platform.
            </p>
          </div>
          {COLUMNS.map(([heading, links]) => (
            <div key={heading}>
              <h4 className="mb-3.5 text-[12.5px] uppercase tracking-wide text-muted">{heading}</h4>
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
        <div className="flex justify-between border-t border-grid pt-5 text-[12.5px] text-muted">
          <span>&copy; 2026 MECHmetrIQ. All rights reserved.</span>
          <span>Made for makers, vendors &amp; procurement teams across India.</span>
        </div>
      </div>
    </footer>
  );
}
