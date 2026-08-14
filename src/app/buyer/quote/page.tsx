import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { QuoteForm } from "./QuoteForm";

export default async function QuotePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: processes }, { data: materials }, { data: addresses }] = await Promise.all([
    supabase
      .from("master_items")
      .select("*")
      .eq("type", "process")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("master_items")
      .select("*")
      .eq("type", "material")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("addresses")
      .select("*")
      .eq("profile_id", user.id)
      .order("is_default", { ascending: false }),
  ]);

  return (
    <>
      <div className="-mx-7 -mt-7 mb-7">
        <Topbar title="Get Instant Quote" />
      </div>
      <QuoteForm
        processes={processes ?? []}
        materials={materials ?? []}
        addresses={addresses ?? []}
      />
    </>
  );
}
