import { ButtonLink } from "@/components/ui/Button";

export function CtaBanner({
  title = "Ready to get started?",
  subtitle = "Join buyers and vendors already sourcing smarter on MECHmetrIQ.",
  primary = { label: "Get Instant Quote →", href: "/register?intent=quote" },
  secondary = { label: "Register as a Vendor", href: "/register" },
}: {
  title?: string;
  subtitle?: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <section className="mx-auto max-w-[1180px] px-8 pb-20">
      <div className="flex items-center justify-between rounded-2xl bg-linear-to-br from-[#12335c] via-brand-dark to-brand px-12 py-11 text-white">
        <div>
          <h2 className="mb-1.5 text-[26px] font-bold tracking-tight">{title}</h2>
          <p className="max-w-[440px] text-[14.5px] leading-relaxed text-[#cfe0f5]">{subtitle}</p>
        </div>
        <div className="flex flex-none gap-3">
          <ButtonLink href={primary.href} size="lg">
            {primary.label}
          </ButtonLink>
          <ButtonLink
            href={secondary.href}
            variant="outline"
            size="lg"
            className="border-white/30 text-white hover:bg-white/10"
          >
            {secondary.label}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
