import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { ButtonLink } from "@/components/ui/Button";

const CUSTOM_STEPS = [
  {
    n: "1",
    title: "Upload your part",
    body: "Drop a CAD file (STEP, STL, IGES, DXF) along with quantity, material, tolerance and finish requirements.",
  },
  {
    n: "2",
    title: "Get matched with vendors",
    body: "Your RFQ goes out to verified Machining/Fabrication vendors who specialise in that process and material.",
  },
  {
    n: "3",
    title: "Compare & accept a quote",
    body: "Review unit price, lead time and vendor rating side by side, then accept the one that fits your job.",
  },
  {
    n: "4",
    title: "Track to delivery",
    body: "Follow your order through production, QC and shipping from your dashboard, with GST invoicing handled automatically.",
  },
];

const MATERIAL_STEPS = [
  {
    n: "1",
    title: "Browse the catalog",
    body: "Search standard stock — sheets, rods, plates and more — by material, grade and dimensions from verified suppliers.",
  },
  {
    n: "2",
    title: "Add to cart & checkout",
    body: "Pick quantity and delivery address, apply a coupon if you have one, and place your order in a few clicks.",
  },
  {
    n: "3",
    title: "Vendor ships with GST invoice",
    body: "The Raw Material Supplier fulfils your order and dispatches with proper GST documentation.",
  },
  {
    n: "4",
    title: "Track delivery",
    body: "Watch order status update in real time — from confirmed, to shipped, to delivered — right in your dashboard.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="bg-surface">
      <SiteHeader />

      <div className="bg-[radial-gradient(600px_300px_at_85%_-10%,var(--color-brand-light),transparent_60%)] px-8 pb-14 pt-16">
        <div className="mx-auto max-w-[720px] text-center">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            How It Works
          </div>
          <h1 className="mb-4 text-[38px] font-bold leading-tight tracking-tight">
            One platform, two ways to source
          </h1>
          <p className="text-[16px] leading-relaxed text-ink-2">
            Whether you need a custom part made or standard raw material delivered, MECHmetrIQ
            connects you with verified vendors and keeps the whole order on one screen.
          </p>
        </div>
      </div>

      <section className="mx-auto max-w-[1180px] px-8 py-16">
        <div className="mb-8">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            Engine 1
          </div>
          <h2 className="text-[28px] font-bold tracking-tight">Custom Manufacturing</h2>
          <p className="mt-1.5 max-w-[560px] text-[15px] text-ink-2">
            From a CAD file to a finished part, quoted and produced by a vendor who specialises in
            your process.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {CUSTOM_STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-grid p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-light text-sm font-extrabold text-brand-dark">
                {s.n}
              </div>
              <b className="mb-1.5 block text-[14.5px]">{s.title}</b>
              <p className="text-[13px] leading-relaxed text-ink-2">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <ButtonLink href="/register?intent=quote">Get Instant Quote &rarr;</ButtonLink>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-8 py-4">
        <div className="mb-8">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            Engine 2
          </div>
          <h2 className="text-[28px] font-bold tracking-tight">Raw Materials Marketplace</h2>
          <p className="mt-1.5 max-w-[560px] text-[15px] text-ink-2">
            Standard metals, plastics and sheets — priced, graded and ready to ship from verified
            suppliers.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {MATERIAL_STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-grid p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-light text-sm font-extrabold text-brand-dark">
                {s.n}
              </div>
              <b className="mb-1.5 block text-[14.5px]">{s.title}</b>
              <p className="text-[13px] leading-relaxed text-ink-2">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <ButtonLink href="/#marketplace" variant="outline">
            Browse Marketplace
          </ButtonLink>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-8 py-16">
        <div className="rounded-2xl border border-grid bg-plane p-10">
          <div className="grid grid-cols-[1.2fr_1fr] items-center gap-10">
            <div>
              <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
                On the other side
              </div>
              <h2 className="mb-2.5 text-[26px] font-bold tracking-tight">
                Are you a manufacturer or material supplier?
              </h2>
              <p className="max-w-[480px] text-[14.5px] leading-relaxed text-ink-2">
                Machining/Fabrication vendors receive RFQs and submit quotes; Raw Material
                Suppliers list stock straight to the marketplace. Each gets its own onboarding,
                KYC and dashboard.
              </p>
            </div>
            <div className="flex justify-end">
              <ButtonLink href="/for-vendors" size="lg">
                See How Vendors Work &rarr;
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <CtaBanner />
      <SiteFooter />
    </div>
  );
}
