import Link from "next/link";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col bg-plane">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[920px] flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="rounded-full bg-brand-light px-3.5 py-1 text-[12px] font-bold text-brand-dark">
          Navigation &amp; Module Directory
        </span>
        <h1 className="mt-3 text-[32px] font-extrabold tracking-tight text-ink">
          This page or module isn&rsquo;t available at this URL
        </h1>
        <p className="mt-2 max-w-[580px] text-[14.5px] leading-relaxed text-ink-2">
          The section you requested may still be under development or requires an authenticated buyer/vendor database session. Use the links below to jump to any active MECHmetrIQ workspace.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/" size="lg">
            &larr; Back to Home Page
          </ButtonLink>
          <ButtonLink href="/ai-cad" variant="outline" size="lg">
            ✨ Open AI-CAD 3D Studio
          </ButtonLink>
          <ButtonLink href="/raw-materials" variant="outline" size="lg">
            Browse Raw Materials Marketplace
          </ButtonLink>
        </div>

        <div className="mt-10 grid w-full gap-3.5 text-left sm:grid-cols-3">
          <Link
            href="/ai-cad"
            className="rounded-xl border border-grid bg-surface p-4 transition hover:border-brand"
          >
            <b className="block text-[14px] text-ink">🧊 AI-CAD 3D Studio</b>
            <p className="mt-1 text-[12.5px] text-ink-2">
              Create turned shafts &amp; bushings via AI Live Chat, upload .STEP/.STL files, and test 1-click DFM fixes.
            </p>
          </Link>
          <Link
            href="/raw-materials"
            className="rounded-xl border border-grid bg-surface p-4 transition hover:border-brand"
          >
            <b className="block text-[14px] text-ink">🧱 Raw Material Marketplace</b>
            <p className="mt-1 text-[12.5px] text-ink-2">
              Browse Round Bars, Hex Bars, Sheets, Plates &amp; Tubes with live ₹/kg pricing and cut-to-size maths.
            </p>
          </Link>
          <Link
            href="/raw-materials/weight-calculator"
            className="rounded-xl border border-grid bg-surface p-4 transition hover:border-brand"
          >
            <b className="block text-[14px] text-ink">⚖️ Metal Weight Calculator</b>
            <p className="mt-1 text-[12.5px] text-ink-2">
              Calculate theoretical piece and batch weights across 14 standard engineering shapes and alloys.
            </p>
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

