import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { loadGradeRates, loadPricingSettings } from "@/lib/smartQuote/data";
import { smartQuoteConfigured } from "@/lib/smartQuote/server";
import { QuoteBuilder } from "./QuoteBuilder";

// STEP files are read in the background (next/server `after`) within this limit.
export const maxDuration = 300;

export default async function QuotePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: addresses }, grades, settings] = await Promise.all([
    supabase
      .from("addresses")
      .select("id, label, full_address")
      .eq("profile_id", user.id)
      .order("is_default", { ascending: false }),
    loadGradeRates(),
    loadPricingSettings(),
  ]);

  return (
    <>
      <div className="-mx-7 -mt-7 mb-7">
        <Topbar title="Get Instant Quote" />
      </div>
      <QuoteBuilder
        userId={user.id}
        addresses={addresses ?? []}
        grades={grades}
        settings={settings}
        instantEnabled={smartQuoteConfigured() && !!settings && grades.length > 0}
      />
    </>
  );
}
