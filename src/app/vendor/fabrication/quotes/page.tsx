import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";

/**
 * Parked: vendors are contracted and orders are assigned at platform-set
 * prices, so vendors don't submit quotes today. Kept in the nav as
 * "Coming soon" in case vendor revision requests are added later.
 */
export default function MyQuotesPage() {
  return (
    <div>
      <Topbar title="My Quotes" pill={{ label: "Coming soon", tone: "brand" }} />
      <div className="mt-6">
        <Card>
          <div className="px-5 py-12 text-center">
            <div className="mb-2 text-[15px] font-semibold text-ink">Coming soon</div>
            <p className="mx-auto max-w-[460px] text-[13px] text-muted">
              MECHmetrIQ sets the price for every order and assigns it to you at your contracted
              rate, so there&rsquo;s nothing to quote for now. Your assigned work is under Jobs
              &amp; Orders.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
