import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";
import { AuthCard } from "@/components/auth/AuthCard";
import { logoutAction } from "@/lib/actions/auth";

export const metadata = { title: "KYC under review · MECHmetrIQ" };

export default async function UnderReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const next = await getDashboardPath(supabase, user.id);
  if (next !== "/account/under-review") redirect(next);

  const { data: vendor } = await supabase
    .from("vendor_profiles")
    .select("vendor_type, company_name, updated_at")
    .eq("id", user.id)
    .single();
  const type = vendor?.vendor_type ?? "fabrication";

  return (
    <AuthCard
      title="Your KYC is under review"
      subtitle={
        <>
          Thanks{vendor?.company_name ? <>, <b className="text-ink">{vendor.company_name}</b></> : ""}. Our team
          is checking your documents &mdash; usually within 2 working days. We&rsquo;ll email you when
          your vendor dashboard is unlocked.
        </>
      }
      width={460}
    >
      <Link
        href={`/vendor/${type}/onboarding`}
        className="mb-3 block w-full rounded-[9px] bg-brand py-3 text-center text-[14.5px] font-bold text-white"
      >
        View submitted KYC
      </Link>
      <div className="flex justify-between text-[12.5px]">
        <Link href="/account/security" className="font-semibold text-brand">
          Account security
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="font-semibold text-brand">
            Log out
          </button>
        </form>
      </div>
    </AuthCard>
  );
}
