import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { CtaBanner } from "@/components/marketing/CtaBanner";

const VALUES = [
  {
    title: "Verified, every time",
    body: "Every vendor on the platform goes through KYC verification before they can quote or list.",
  },
  {
    title: "Transparency by default",
    body: "Clear pricing, real lead times and honest order tracking — no surprises for buyers or vendors.",
  },
  {
    title: "Built for makers",
    body: "From individual buyers to procurement teams, the platform is designed around how sourcing actually happens.",
  },
];

export default function AboutPage() {
  return (
    <div className="bg-surface">
      <SiteHeader />

      <div className="bg-[radial-gradient(600px_300px_at_85%_-10%,var(--color-brand-light),transparent_60%)] px-8 pb-14 pt-16">
        <div className="mx-auto max-w-[720px] text-center">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            About Us
          </div>
          <h1 className="mb-4 text-[38px] font-bold leading-tight tracking-tight">
            Making sourcing simpler for buyers and vendors
          </h1>
          <p className="text-[16px] leading-relaxed text-ink-2">
            MECHmetrIQ brings custom manufacturing and raw materials sourcing together on one
            platform, connecting buyers with verified vendors across India.
          </p>
        </div>
      </div>

      <section className="mx-auto max-w-[1180px] px-8 py-16">
        <div className="grid grid-cols-[1.1fr_.9fr] items-center gap-12">
          <div>
            <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
              Our Story
            </div>
            <h2 className="mb-4 text-[26px] font-bold tracking-tight">
              Two engines, one platform
            </h2>
            <p className="mb-3 text-[14.5px] leading-relaxed text-ink-2">
              Sourcing a custom part and buying standard raw material are usually two completely
              different processes, handled through different channels with little visibility into
              pricing or timelines. MECHmetrIQ was built to bring both under one roof — a
              quote-to-order engine for custom manufacturing, and a marketplace for standard
              materials — so buyers and vendors can work from a single, transparent dashboard.
            </p>
            <p className="text-[14.5px] leading-relaxed text-ink-2">
              We work with verified Machining/Fabrication vendors and Raw Material Suppliers to
              make sure every quote, listing and order on the platform is backed by a real,
              KYC-verified business.
            </p>
          </div>
          <div className="rounded-2xl border border-grid bg-plane p-8">
            <div className="grid grid-cols-2 gap-6 text-center">
              <div>
                <b className="block text-[28px] font-extrabold text-brand-dark">1,200+</b>
                <span className="text-[12.5px] text-muted">Verified vendors</span>
              </div>
              <div>
                <b className="block text-[28px] font-extrabold text-brand-dark">40,000+</b>
                <span className="text-[12.5px] text-muted">Parts quoted</span>
              </div>
              <div>
                <b className="block text-[28px] font-extrabold text-brand-dark">₹210 Cr+</b>
                <span className="text-[12.5px] text-muted">Orders processed</span>
              </div>
              <div>
                <b className="block text-[28px] font-extrabold text-brand-dark">4.8/5</b>
                <span className="text-[12.5px] text-muted">Avg. rating</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-8 py-4">
        <div className="mx-auto mb-10 max-w-[600px] text-center">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            What we stand for
          </div>
          <h2 className="text-[28px] font-bold tracking-tight">Our values</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-xl border border-grid p-5">
              <b className="mb-1.5 block text-[14.5px]">{v.title}</b>
              <p className="text-[13px] leading-relaxed text-ink-2">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-[1180px] scroll-mt-20 px-8 py-16">
        <div className="rounded-2xl border border-grid bg-plane p-10 text-center">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            Get in Touch
          </div>
          <h2 className="mb-2.5 text-[26px] font-bold tracking-tight">
            Questions about sourcing or onboarding?
          </h2>
          <p className="mx-auto mb-6 max-w-[480px] text-[14.5px] leading-relaxed text-ink-2">
            Our team can help you get a job quoted, source materials, or get your vendor account
            set up. Reach out and we&apos;ll get back to you.
          </p>
          <a
            href="mailto:hello@mechmetriq.com"
            className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-brand hover:underline"
          >
            hello@mechmetriq.com &rarr;
          </a>
        </div>
      </section>

      <CtaBanner />
      <SiteFooter />
    </div>
  );
}
