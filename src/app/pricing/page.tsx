import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { ButtonLink } from "@/components/ui/Button";

const BUYER_POINTS = [
  {
    title: "No platform fee to get a quote",
    body: "Uploading a CAD file or browsing the raw materials marketplace is free. You only pay for the parts or materials you order.",
  },
  {
    title: "Transparent, itemised pricing",
    body: "Every quote and order shows unit price, quantity, lead time and applicable taxes before you accept.",
  },
  {
    title: "Pay only on acceptance",
    body: "For custom manufacturing, nothing is charged until you accept a vendor's quote and confirm the order.",
  },
];

const VENDOR_POINTS = [
  {
    title: "Free to list & quote",
    body: "Machining/Fabrication vendors can respond to RFQs, and Raw Material Suppliers can list stock, at no upfront cost.",
  },
  {
    title: "Success-based model",
    body: "MECHmetrIQ earns only when you win business through the platform — our incentives are aligned with yours.",
  },
  {
    title: "No hidden charges",
    body: "Any applicable fees are shown clearly before you accept an order, with GST-compliant invoicing built in.",
  },
];

export default function PricingPage() {
  return (
    <div className="bg-surface">
      <SiteHeader />

      <div className="bg-[radial-gradient(600px_300px_at_85%_-10%,var(--color-brand-light),transparent_60%)] px-8 pb-14 pt-16">
        <div className="mx-auto max-w-[720px] text-center">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            Pricing
          </div>
          <h1 className="mb-4 text-[38px] font-bold leading-tight tracking-tight">
            Simple, transparent pricing for buyers and vendors
          </h1>
          <p className="text-[16px] leading-relaxed text-ink-2">
            Exact pricing depends on your order volume and use case. Here&apos;s how the model
            works on each side of the platform — reach out to our team for a plan tailored to you.
          </p>
        </div>
      </div>

      <section className="mx-auto max-w-[1180px] px-8 py-16">
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-2xl border border-grid p-7">
            <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
              For Buyers
            </div>
            <h2 className="mb-5 text-[24px] font-bold tracking-tight">
              Source parts &amp; materials
            </h2>
            <div className="space-y-4">
              {BUYER_POINTS.map((p) => (
                <div key={p.title} className="border-t border-grid pt-4 first:border-t-0 first:pt-0">
                  <b className="mb-1 block text-[14px]">{p.title}</b>
                  <p className="text-[13px] leading-relaxed text-ink-2">{p.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <ButtonLink href="/register?intent=quote">Get Instant Quote &rarr;</ButtonLink>
            </div>
          </div>

          <div className="rounded-2xl border border-grid bg-plane p-7">
            <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
              For Vendors
            </div>
            <h2 className="mb-5 text-[24px] font-bold tracking-tight">
              Grow your order book
            </h2>
            <div className="space-y-4">
              {VENDOR_POINTS.map((p) => (
                <div key={p.title} className="border-t border-grid pt-4 first:border-t-0 first:pt-0">
                  <b className="mb-1 block text-[14px]">{p.title}</b>
                  <p className="text-[13px] leading-relaxed text-ink-2">{p.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <ButtonLink href="/for-vendors" variant="outline">
                See Vendor Benefits &rarr;
              </ButtonLink>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-grid bg-surface p-6 text-center">
          <p className="text-[14px] text-ink-2">
            Have a large order or a custom sourcing programme in mind?{" "}
            <a href="/about#contact" className="font-semibold text-brand hover:underline">
              Contact our team
            </a>{" "}
            for a plan built around your volume.
          </p>
        </div>
      </section>

      <CtaBanner />
      <SiteFooter />
    </div>
  );
}
