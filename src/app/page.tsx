import { ButtonLink } from "@/components/ui/Button";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { InstantQuoteDemo } from "@/components/marketing/InstantQuoteDemo";
import { cn } from "@/lib/cn";

const PROCESSES = [
  { code: "CNC", name: "CNC Machining", comingSoon: false },
  { code: "3D", name: "3D Printing", comingSoon: true },
  { code: "SM", name: "Sheet Metal", comingSoon: true },
  { code: "IM", name: "Injection Moulding", comingSoon: true },
  { code: "CA", name: "Casting", comingSoon: true },
  { code: "LC", name: "Laser Cutting", comingSoon: true },
];

const PRODUCTS = [
  { img: "ALUMINIUM SHEET", cat: "Metals", name: "Al 6061 Sheet, 2mm", price: "₹340" },
  { img: "SS ROD", cat: "Metals", name: "SS 304 Round Rod, 12mm", price: "₹410" },
  { img: "ABS BLOCK", cat: "Plastics", name: "ABS Engineering Block", price: "₹185" },
  { img: "MS PLATE", cat: "Metals", name: "Mild Steel Plate, 5mm", price: "₹78" },
];

const TESTIMONIALS = [
  {
    quote:
      "We cut our sourcing time for custom brackets from two weeks to two days. The instant quote is scarily accurate.",
    initials: "RK",
    name: "Rahul Kapoor",
    role: "Procurement Lead, OEM",
  },
  {
    quote:
      "As a vendor, the RFQ inbox keeps our shop floor busy without us chasing a single lead ourselves.",
    initials: "SM",
    name: "Sana Mirza",
    role: "Owner, Precision Fab Works",
  },
  {
    quote: "GST invoicing and delivery tracking on raw material orders alone was worth switching for.",
    initials: "AV",
    name: "Arjun Verma",
    role: "Founder, Startup Hardware Co.",
  },
];

export default function HomePage() {
  return (
    <div className="bg-surface">
      <SiteHeader />

      {/* Hero */}
      <div className="bg-[radial-gradient(600px_300px_at_85%_-10%,var(--color-brand-light),transparent_60%)] pb-16 pt-[76px]">
        <div className="mx-auto grid max-w-[1180px] grid-cols-[1.05fr_.95fr] items-center gap-14 px-8">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1.5 text-[12.5px] font-bold text-brand-dark">
              &bull; Verified vendors &middot; GST-ready &middot; Pan-India
            </span>
            <h1 className="my-4 text-[46px] font-bold leading-[1.08] tracking-tight">
              Upload a part.
              <br />
              Get an instant quote.
            </h1>
            <p className="mb-7 max-w-[480px] text-[17px] leading-relaxed text-ink-2">
              One platform for on-demand custom manufacturing and raw materials sourcing. Upload a
              CAD file for instant pricing, or buy metals, plastics and sheets straight from
              verified vendors.
            </p>
            <div className="mb-8 flex gap-3">
              <ButtonLink href="/register?intent=quote" size="lg">
                Get Instant Quote &rarr;
              </ButtonLink>
              <ButtonLink href="/#marketplace" variant="outline" size="lg">
                Browse Marketplace
              </ButtonLink>
            </div>
            <div className="flex items-center gap-6 text-[13px] text-muted">
              <span>
                <b className="text-ink">1,200+</b> vendors
              </span>
              <span>&middot;</span>
              <span>
                <b className="text-ink">40,000+</b> parts quoted
              </span>
              <span>&middot;</span>
              <span>
                <b className="text-ink">4.8/5</b> avg. rating
              </span>
            </div>
          </div>

          <InstantQuoteDemo />
        </div>
      </div>

      {/* Processes */}
      <section className="mx-auto max-w-[1180px] px-8 py-16">
        <div className="mx-auto mb-10 max-w-[600px] text-center">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            Capabilities
          </div>
          <h2 className="mb-2.5 text-[32px] font-bold tracking-tight">
            Manufacturing processes we cover
          </h2>
          <p className="text-[15px] text-ink-2">
            Every job is routed to verified vendors who specialise in that exact process.
          </p>
        </div>
        <div className="grid grid-cols-6 gap-3.5">
          {PROCESSES.map((p) => (
            <div
              key={p.code}
              className={cn(
                "relative rounded-xl border border-grid px-3.5 py-5 text-center",
                p.comingSoon && "bg-plane",
              )}
            >
              {p.comingSoon && (
                <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-warn-bg px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-warn">
                  Coming Soon
                </span>
              )}
              <div
                className={cn(
                  "mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[10px] text-sm font-extrabold",
                  p.comingSoon ? "bg-white text-muted" : "bg-brand-light text-brand-dark",
                )}
              >
                {p.code}
              </div>
              <div className={cn("text-[13px] font-semibold", p.comingSoon && "text-ink-2")}>
                {p.name}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Marketplace teaser */}
      <section id="marketplace" className="mx-auto max-w-[1180px] scroll-mt-20 px-8 py-16">
        <div className="mx-auto mb-10 max-w-[600px] text-center">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            Raw Materials Marketplace
          </div>
          <h2 className="mb-2.5 text-[32px] font-bold tracking-tight">
            Buy metals, plastics &amp; sheets directly
          </h2>
          <p className="text-[15px] text-ink-2">
            Standard stock from verified vendors &mdash; priced, graded and ready to ship.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {PRODUCTS.map((p) => (
            <div key={p.name} className="overflow-hidden rounded-xl border border-grid">
              <div className="flex h-[110px] items-center justify-center bg-linear-to-br from-[#eef2f6] to-[#e3e8ee] text-[11px] tracking-wide text-muted">
                {p.img}
              </div>
              <div className="p-3.5">
                <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">{p.cat}</div>
                <div className="mb-1.5 text-[13.5px] font-semibold">{p.name}</div>
                <div className="text-sm font-extrabold">
                  {p.price} <span className="text-[11.5px] font-normal text-muted">/ kg</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-[1180px] px-8">
        <div className="grid grid-cols-4 rounded-2xl bg-ink px-12 py-10 text-white">
          {[
            ["1,200+", "Verified vendors"],
            ["₹210 Cr+", "Orders processed"],
            ["40,000+", "Parts quoted"],
            ["18 hrs", "Avg. quote turnaround"],
          ].map(([value, label]) => (
            <div key={label}>
              <b className="block text-[30px] font-extrabold">{value}</b>
              <span className="text-[12.5px] text-[#c3c2b7]">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-[1180px] px-8 py-16">
        <div className="mx-auto mb-10 max-w-[600px] text-center">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            Testimonials
          </div>
          <h2 className="text-[32px] font-bold tracking-tight">
            Trusted by procurement teams &amp; makers
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-4.5">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-2xl border border-grid p-5.5">
              <p className="mb-4 text-[13.5px] leading-relaxed text-ink-2">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-brand-light text-xs font-bold text-brand-dark">
                  {t.initials}
                </div>
                <div>
                  <b className="block text-[13px]">{t.name}</b>
                  <span className="text-[11.5px] text-muted">{t.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
