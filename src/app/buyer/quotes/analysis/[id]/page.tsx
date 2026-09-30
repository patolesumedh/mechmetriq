import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/Topbar";
import { CadAnalysisReport } from "@/components/smartQuote/CadAnalysisReport";
import type { CadAnalysisResult } from "@/lib/smartQuote/shared";

export default async function BuyerAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS limits this to the buyer's own analyses.
  const { data: row } = await supabase
    .from("cad_analyses")
    .select("id, buyer_id, file_name, status, result")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.buyer_id !== user.id || row.status !== "completed" || !row.result) notFound();

  return (
    <>
      <div className="-mx-7 -mt-7 mb-7">
        <Topbar title={row.file_name} />
      </div>
      <Link href="/buyer/quotes" className="mb-4 inline-block text-[12.5px] font-semibold text-brand">
        &larr; Back to My Quotes
      </Link>
      <div className="max-w-[900px]">
        <CadAnalysisReport result={row.result as unknown as CadAnalysisResult} />
      </div>
    </>
  );
}
