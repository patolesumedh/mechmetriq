import { cn } from "@/lib/cn";

const tones = {
  pending: "bg-warn-bg text-[#8a5a00]",
  quoted: "bg-brand-light text-brand-dark",
  accepted: "bg-good-bg text-[#0a6b0a]",
  production: "bg-[#eee9fb] text-accent-violet",
  shipped: "bg-accent-orange-bg text-[#a8461a]",
  delivered: "bg-good-bg text-[#0a6b0a]",
  disputed: "bg-crit-bg text-[#a12525]",
  new: "bg-accent-orange-bg text-[#a8461a]",
  won: "bg-good-bg text-[#0a6b0a]",
  lost: "bg-[#f2f1ee] text-muted",
  active: "bg-good-bg text-[#0a6b0a]",
  inactive: "bg-[#f2f1ee] text-muted",
  review: "bg-warn-bg text-[#8a5a00]",
  approved: "bg-good-bg text-[#0a6b0a]",
  rejected: "bg-crit-bg text-[#a12525]",
  open: "bg-crit-bg text-[#a12525]",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}
