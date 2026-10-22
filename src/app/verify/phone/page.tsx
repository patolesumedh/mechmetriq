import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";
import { AuthCard } from "@/components/auth/AuthCard";
import { logoutAction } from "@/lib/actions/auth";
import { PhoneForm } from "./PhoneForm";

export const metadata = { title: "Verify your mobile · MECHmetrIQ" };

export default async function VerifyPhonePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const next = await getDashboardPath(supabase, user.id);
  if (next !== "/verify/phone") redirect(next);

  const { data: profile } = await supabase.from("profiles").select("phone").eq("id", user.id).single();

  return (
    <AuthCard
      title="Verify your mobile number"
      subtitle="One last step. We'll text you a 6-digit code to confirm this number belongs to you."
    >
      <PhoneForm phone={profile?.phone ?? ""} />
      <form action={logoutAction} className="mt-5 text-center text-[12.5px] text-ink-2">
        Not you?{" "}
        <button type="submit" className="font-semibold text-brand">
          Log out
        </button>
      </form>
    </AuthCard>
  );
}
