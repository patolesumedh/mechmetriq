import { cn } from "@/lib/cn";
import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "outline";
type Size = "md" | "lg";

/**
 * MechOneHub Button System (Design System v1.0 — Section 4).
 *
 * - Primary: Orange (#FF7900) with Deep Navy (#0B2140) text (WCAG AA 6.1:1).
 *   Never put white text on #FF7900.
 * - Secondary (outline): White surface, 1px #102D52 border & #102D52 label.
 * - Ghost: Transparent bg, #102D52 label, #EAF0F7 hover.
 * - Height: 40px (md) / 48px (lg), radius 6px, padding 0 16px, Archivo 14px/600.
 */
const base =
  "btn inline-flex items-center justify-center gap-2 rounded-[6px] font-semibold transition-colors duration-120 ease-out disabled:cursor-not-allowed disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-[#FF7900] text-[#0B2140] border border-[#FF7900] hover:bg-[#F27300] hover:border-[#F27300] active:bg-[#E66C00] active:border-[#E66C00] disabled:bg-[#E6EAF0] disabled:text-[#94A1B2] disabled:border-[#E6EAF0]",
  outline:
    "bg-surface border border-[#102D52] text-[#102D52] hover:bg-[#EAF0F7] active:bg-[#D9E3EF] disabled:bg-transparent disabled:border-[#D8DFE8] disabled:text-[#94A1B2]",
  ghost:
    "bg-transparent text-[#102D52] hover:bg-[#EAF0F7] active:bg-[#D9E3EF] disabled:text-[#94A1B2]",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-4 text-[14px]",
  lg: "h-12 px-5 text-[15px]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props} />
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}
