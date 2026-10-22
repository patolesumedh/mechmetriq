import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";
import { AuthCard } from "@/components/auth/AuthCard";
import { logoutAction } from "@/lib/actions/auth";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/kyc/rules";

export const metadata = { title: "Account on hold · MECHmetrIQ" };

export default async function SuspendedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if ((await getDashboardPath(supabase, user.id)) !== "/account/suspended") redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_status, suspended_reason")
    .eq("id", user.id)
    .single();

  return (
    <AuthCard
      title={profile?.account_status === "suspended" ? "Your account is suspended" : "Your vendor account is on hold"}
      subtitle="You can't use MECHmetrIQ dashboards while your account is in this state. Your data is safe and nothing has been deleted."
      width={460}
    >
      {profile?.suspended_reason && (
        <div className="mb-4 rounded-lg bg-warn-bg px-3.5 py-3 text-[13px] text-[#8a5a00]">
          <b>Reason:</b> {profile.suspended_reason}
        </div>
      )}
      <p className="mb-5 text-[13px] text-ink-2">
        To resolve this, email{" "}
        <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="font-semibold text-brand">
          {PRIVACY_CONTACT_EMAIL}
        </a>{" "}
        from your registered email address.
      </p>
      <form action={logoutAction}>
        <button type="submit" className="w-full rounded-[9px] border border-grid py-3 text-[14px] font-bold text-ink-2">
          Log out
        </button>
      </form>
    </AuthCard>
  );
}
