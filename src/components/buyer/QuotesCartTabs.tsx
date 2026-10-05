import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Shared tab row for the merged "Quotes & Cart" nav item — Custom Part
 * Quotes (/buyer/quotes) and Raw Material Cart (/buyer/cart) are two
 * different buyer journeys (custom manufacturing vs. raw materials) that
 * both represent "in progress before this becomes an Order", so they share
 * one nav slot with tabs instead of two separate top-level nav items.
 */
export function QuotesCartTabs({
  active,
  quotesCount,
  cartCount,
}: {
  active: "quotes" | "cart";
  quotesCount?: number;
  cartCount?: number;
}) {
  const tabs = [
    { key: "quotes" as const, label: "Custom Part Quotes", href: "/buyer/quotes", count: quotesCount },
    { key: "cart" as const, label: "Raw Material Cart", href: "/buyer/cart", count: cartCount },
  ];

  return (
    <div className="-mt-1 mb-5 flex gap-1 border-b border-grid">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            "flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13.5px] font-semibold",
            active === tab.key
              ? "border-brand text-brand-dark"
              : "border-transparent text-ink-2 hover:text-ink"
          )}
        >
          {tab.label}
          {typeof tab.count === "number" && tab.count > 0 && (
            <span className="rounded-full bg-accent-orange px-[7px] py-px text-[10.5px] font-extrabold text-white">
              {tab.count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
