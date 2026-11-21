import { cn } from "@/lib/cn";

/**
 * MechOneHub Official Vector Logo & M1 Mark (Design System v1.0 — Section 6).
 *
 * Colours:
 *  - Brand Navy:   #102D52 (light mode structure & wordmark "mech" / "hub")
 *  - Brand Orange: #FF7900 (always preserved on "1" in the M1 mark and "one" in wordmark)
 *  - White:        #FFFFFF (dark mode wordmark "mech" / "hub" & M inside navy tile)
 */
export function MechOneHubMark({
  size = 30,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("flex-none", className)}
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="7" fill="#102D52" />
      <path
        d="M6.5 27V9H10.6L15.2 19.2L19.8 9H23.9V27H20.3V15.4L16.3 24.1H14.1L10.1 15.4V27H6.5Z"
        fill="#FFFFFF"
      />
      <rect x="25.5" y="9" width="4" height="18" rx="0.8" fill="#FF7900" />
      <path d="M23.2 11.4L26.5 9H29.5V12.2L23.2 14.5V11.4Z" fill="#FF7900" />
    </svg>
  );
}

export function MechOneHubLogo({
  variant = "horizontal",
  theme = "light",
  markSize = 30,
  suffix,
  className,
}: {
  variant?: "horizontal" | "stacked" | "mark";
  theme?: "light" | "dark";
  markSize?: number;
  suffix?: string;
  className?: string;
}) {
  if (variant === "mark") {
    return <MechOneHubMark size={markSize} className={className} />;
  }

  const baseColor = theme === "dark" ? "text-white" : "text-[#102D52]";

  if (variant === "stacked") {
    return (
      <span
        className={cn(
          "inline-flex flex-col items-center gap-2 font-bold tracking-[-0.015em]",
          className
        )}
      >
        <MechOneHubMark size={40} />
        <span className={cn("text-[21px] leading-none", baseColor)}>
          mech<span className="text-[#FF7900]">one</span>hub
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 font-bold tracking-[-0.015em]",
        className
      )}
    >
      <MechOneHubMark size={markSize} />
      <span className={cn("leading-none", baseColor)}>
        mech<span className="text-[#FF7900]">one</span>hub
        {suffix ? (
          <span className="ml-1.5 text-[0.78em] font-semibold text-[#56677E]">
            {suffix}
          </span>
        ) : null}
      </span>
    </span>
  );
}
