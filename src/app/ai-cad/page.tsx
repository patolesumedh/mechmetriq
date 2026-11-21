import Link from "next/link";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { AiCadStudio } from "@/components/aiCad/AiCadStudio";

export const metadata = {
  title: "AI-CAD Live Studio — MechOneHub",
  description:
    "Interactive AI Live Chat to 3D Turning CAD, 1-Click DFM Repair, What-If Price Sliders, and STEP AP242 Export.",
};

export default function AiCadPage() {
  return (
    <div className="flex min-h-screen flex-col bg-plane">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1640px] flex-1 px-4 py-3 sm:px-6">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-light px-2.5 py-0.5 text-[11px] font-bold text-brand-dark">
              ✨ 2D Profile-First B-Rep &middot; ISO 10303 AP242
            </span>
            <h1 className="text-[19px] font-extrabold tracking-tight text-ink sm:text-[21px]">
              AI Live Chat to 3D Turning CAD &amp; Instant Quote Studio
            </h1>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            <Link
              href="/raw-materials"
              className="rounded-lg border border-grid bg-surface px-3 py-1 font-semibold text-ink-2 hover:border-brand hover:text-ink"
            >
              Browse Raw Materials &rarr;
            </Link>
            <Link
              href="/raw-materials/weight-calculator"
              className="rounded-lg border border-grid bg-surface px-3 py-1 font-semibold text-ink-2 hover:border-brand hover:text-ink"
            >
              Weight Calculator
            </Link>
          </div>
        </div>

        <AiCadStudio />
      </main>
      <SiteFooter />
    </div>
  );
}
