import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { ButtonLink } from "@/components/ui/Button";

const BENEFITS = [
  {
    title: "Steady stream of RFQs / demand",
    body: "Get matched to buyers actively looking for your process or material — no cold outreach needed.",
  },
  {
    title: "Your own dashboard",
    body: "Manage RFQs, quotes, orders and (for material suppliers) listings from one place, built for your workflow.",
  },
  {
    title: "Get paid reliably",
    body: "Clear order status tracking and GST-compliant invoicing on every transaction.",
  },
  {
    title: "Build your reputation",
    body: "Ratings and completed-order history help you win more business over time.",
  },
];

const FAB_STEPS = [
  { n: "1", title: "Register & verify (KYC)", body: "Sign up as a Machining/Fabrication vendor and complete KYC verification." },
  { n: "2", title: "Set your capabilities", body: "Tell us which processes, materials and tolerances you specialise in." },
  { n: "3", title: "Receive matched RFQs", body: "Get notified when a buyer's job fits your capabilities." },
  { n: "4", title: "Quote & fulfil", body: "Submit a quote, get accepted, and manage the order through to delivery." },
];

const MATERIAL_STEPS = [
  { n: "1", title: "Register & verify (KYC)", body: "Sign up as a Raw Material Supplier and complete KYC verification." },
  { n: "2", title: "List your stock", body: "Add materials with grade, dimensions, pricing and available quantity." },
  { n: "3", title: "Receive orders", body: "Buyers order directly from your listings in the marketplace." },
  { n: "4", title: "Ship & invoice", body: "Fulfil the order and dispatch with GST-compliant invoicing." },
];

export default function ForVendorsPage() {
  return (
    <div className="bg-surface">
      <SiteHeader />

      <div className="bg-[radial-gradient(600px_300px_at_85%_-10%,var(--color-brand-light),transparent_60%)] px-8 pb-14 pt-16">
        <div className="mx-auto max-w-[720px] text-center">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            For Vendors
          </div>
          <h1 className="mb-4 text-[38px] font-bold leading-tight tracking-tight">
            Grow your shop or supply business on MECHmetrIQ
          </h1>
          <p className="mb-7 text-[16px] leading-relaxed text-ink-2">
            Whether you run a machining/fabrication shop or supply raw materials, MECHmetrIQ
            brings verified demand straight to your dashboard.
          </p>
          <div className="flex justify-center gap-3">
            <ButtonLink href="/register" size="lg">
              Register as a Vendor &rarr;
            </ButtonLink>
            <ButtonLink href="/login" variant="outline" size="lg">
              Vendor Log In
            </ButtonLink>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-[1180px] px-8 py-16">
        <div className="mx-auto mb-10 max-w-[600px] text-center">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            Why vendors choose us
          </div>
          <h2 className="text-[28px] font-bold tracking-tight">Built for your business</h2>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-xl border border-grid p-5">
              <b className="mb-1.5 block text-[14px]">{b.title}</b>
              <p className="text-[13px] leading-relaxed text-ink-2">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-8 py-4">
        <div className="mb-8">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            Machining / Fabrication Vendors
          </div>
          <h2 className="text-[26px] font-bold tracking-tight">Onboarding steps</h2>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {FAB_STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-grid p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-light text-sm font-extrabold text-brand-dark">
                {s.n}
              </div>
              <b className="mb-1.5 block text-[14px]">{s.title}</b>
              <p className="text-[13px] leading-relaxed text-ink-2">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-8 py-16">
        <div className="mb-8">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            Raw Material Suppliers
          </div>
          <h2 className="text-[26px] font-bold tracking-tight">Onboarding steps</h2>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {MATERIAL_STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-grid p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-light text-sm font-extrabold text-brand-dark">
                {s.n}
              </div>
              <b className="mb-1.5 block text-[14px]">{s.title}</b>
              <p className="text-[13px] leading-relaxed text-ink-2">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <CtaBanner
        title="Ready to grow your order book?"
        subtitle="Register your business and start receiving matched demand on MECHmetrIQ."
        primary={{ label: "Register as a Vendor →", href: "/register" }}
        secondary={{ label: "Talk to Our Team", href: "/about#contact" }}
      />
      <SiteFooter />
    </div>
  );
}
