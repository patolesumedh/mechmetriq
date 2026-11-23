import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { loadGradeRates, loadPricingSettings } from "@/lib/smartQuote/data";
import type { GradeOption } from "@/lib/smartQuote/pricingFormat";
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

  // Strip rate_per_kg and proprietary sq_settings before passing props to the client
  const gradeOptions: GradeOption[] = grades.map((g) => ({
    id: g.id,
    name: g.name,
    material_slug: g.material_slug,
    material_name: g.material_name,
  }));

  return (
    <>
      <div className="-mx-7 -mt-7 mb-7">
        <Topbar title="Get Instant Quote" />
      </div>
      <QuoteBuilder
        addresses={addresses ?? []}
        grades={gradeOptions}
        instantEnabled={smartQuoteConfigured() && !!settings && grades.length > 0}
      />
    </>
  );
}
