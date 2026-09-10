import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { CtaBanner } from "@/components/marketing/CtaBanner";
import { cn } from "@/lib/cn";

const PROCESSES = [
  {
    code: "CNC",
    name: "CNC Machining",
    body: "Precision milling and turning for metals and plastics, from prototypes to production runs.",
    comingSoon: false,
  },
  {
    code: "3D",
    name: "3D Printing",
    body: "FDM, SLA and SLS printing for rapid prototypes and low-volume functional parts.",
    comingSoon: true,
  },
  {
    code: "SM",
    name: "Sheet Metal",
    body: "Bending, punching and forming for brackets, enclosures and structural components.",
    comingSoon: true,
  },
  {
    code: "IM",
    name: "Injection Moulding",
    body: "Tooling and moulding for medium-to-high volume plastic parts.",
    comingSoon: true,
  },
  {
    code: "CA",
    name: "Casting",
    body: "Sand and die casting for complex metal geometries at scale.",
    comingSoon: true,
  },
  {
    code: "LC",
    name: "Laser Cutting",
    body: "Fast, clean cutting of sheet stock across metals and select plastics.",
    comingSoon: true,
  },
];

const MATERIAL_CATEGORIES = [
  {
    name: "Metals",
    items: "Aluminium, Mild Steel, Stainless Steel, Brass, Copper",
  },
  {
    name: "Plastics",
    items: "ABS, Nylon, Polycarbonate, Acrylic, HDPE",
  },
  {
    name: "Sheets & Plates",
    items: "Standard and custom-cut sheets, plates and rods",
  },
  {
    name: "Specialty Alloys",
    items: "Titanium, Tool Steel and grade-specific alloys on request",
  },
];

const VALUE_ADDED = [
  {
    name: "Surface Finishing",
    body: "Anodizing, powder coating, bead blasting and plating options at checkout.",
  },
  {
    name: "Quality Inspection",
    body: "Dimensional QC reports available on request for critical parts.",
  },
  {
    name: "Logistics & GST Invoicing",
    body: "Pan-India delivery with proper GST documentation on every order.",
  },
];

export default function ServicesPage() {
  return (
    <div className="bg-surface">
      <SiteHeader />

      <div className="bg-[radial-gradient(600px_300px_at_85%_-10%,var(--color-brand-light),transparent_60%)] px-8 pb-14 pt-16">
        <div className="mx-auto max-w-[720px] text-center">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            Services
          </div>
          <h1 className="mb-4 text-[38px] font-bold leading-tight tracking-tight">
            Manufacturing processes &amp; materials, all in one place
          </h1>
          <p className="text-[16px] leading-relaxed text-ink-2">
            Whatever the job needs — a machined part or standard stock delivered fast — MECHmetrIQ
            routes it to a verified vendor who specialises in it.
          </p>
        </div>
      </div>

      <section className="mx-auto max-w-[1180px] px-8 py-16">
        <div className="mb-8 max-w-[560px]">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            Custom Manufacturing
          </div>
          <h2 className="text-[28px] font-bold tracking-tight">Processes we cover</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {PROCESSES.map((p) => (
            <div
              key={p.code}
              className={cn("relative rounded-xl border border-grid p-5", p.comingSoon && "bg-plane")}
            >
              {p.comingSoon && (
                <span className="absolute right-4 top-4 whitespace-nowrap rounded-full bg-warn-bg px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-warn">
                  Coming Soon
                </span>
              )}
              <div
                className={cn(
                  "mb-3 flex h-9 w-9 items-center justify-center rounded-[10px] text-sm font-extrabold",
                  p.comingSoon ? "bg-white text-muted" : "bg-brand-light text-brand-dark",
                )}
              >
                {p.code}
              </div>
              <b className="mb-1.5 block text-[14.5px]">{p.name}</b>
              <p className="text-[13px] leading-relaxed text-ink-2">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="marketplace-services" className="mx-auto max-w-[1180px] px-8 py-4">
        <div className="mb-8 max-w-[560px]">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            Raw Materials Marketplace
          </div>
          <h2 className="text-[28px] font-bold tracking-tight">Material categories</h2>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {MATERIAL_CATEGORIES.map((c) => (
            <div key={c.name} className="rounded-xl border border-grid p-5">
              <b className="mb-1.5 block text-[14.5px]">{c.name}</b>
              <p className="text-[13px] leading-relaxed text-ink-2">{c.items}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-8 py-16">
        <div className="mb-8 max-w-[560px]">
          <div className="mb-2 text-[12.5px] font-bold uppercase tracking-wide text-brand">
            Add-ons
          </div>
          <h2 className="text-[28px] font-bold tracking-tight">Value-added services</h2>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {VALUE_ADDED.map((v) => (
            <div key={v.name} className="rounded-xl border border-grid bg-plane p-5">
              <b className="mb-1.5 block text-[14.5px]">{v.name}</b>
              <p className="text-[13px] leading-relaxed text-ink-2">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <CtaBanner />
      <SiteFooter />
    </div>
  );
}
