import { cn } from "@/lib/cn";

/**
 * MechOneHub Machining & Order Status Pills (Design System v1.0 — Section 3.3).
 *
 * 24px tall, 10px horizontal padding, 6px dot in the text colour, 12px/500 text.
 */
const tones = {
  pending: "bg-[#FDF3E1] text-[#8A5300]",
  quoted: "bg-[#E4ECF6] text-[#1D4E89]",
  accepted: "bg-[#E6F4EA] text-[#166534]",
  production: "bg-[#E4ECF6] text-[#1D4E89]",
  shipped: "bg-[#FDF3E1] text-[#8A5300]",
  delivered: "bg-[#E6F4EA] text-[#166534]",
  completed: "bg-[#E6F4EA] text-[#166534]",
  disputed: "bg-[#FBE9E9] text-[#991B1B]",
  new: "bg-[#FDF3E1] text-[#8A5300]",
  won: "bg-[#E6F4EA] text-[#166534]",
  lost: "bg-[#EEF1F5] text-[#4A5A70]",
  active: "bg-[#E6F4EA] text-[#166534]",
  inactive: "bg-[#EEF1F5] text-[#4A5A70]",
  review: "bg-[#FDF3E1] text-[#8A5300]",
  approved: "bg-[#E6F4EA] text-[#166534]",
  rejected: "bg-[#FBE9E9] text-[#991B1B]",
  open: "bg-[#FBE9E9] text-[#991B1B]",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-[10px] text-[12px] font-medium leading-none",
        tones[tone]
      )}
    >
      <span className="h-1.5 w-1.5 flex-none rounded-full bg-current" aria-hidden="true" />
      {children}
    </span>
  );
}
