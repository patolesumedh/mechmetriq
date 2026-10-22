import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";
import { AuthCard } from "@/components/auth/AuthCard";
import { PENDING_EMAIL_COOKIE } from "./constants";
import { ResendForm } from "./ResendForm";

export const metadata = { title: "Verify your email · MECHmetrIQ" };

export default async function VerifyEmailPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Already verified (e.g. clicked the link in another tab): move on.
  if (user?.email_confirmed_at) {
    const next = await getDashboardPath(supabase, user.id);
    if (next !== "/verify/email") redirect(next);
  }

  const email = user?.email ?? (await cookies()).get(PENDING_EMAIL_COOKIE)?.value ?? "";

  return (
    <AuthCard
      title="Check your inbox"
      subtitle={
        <>
          We sent a verification link to {email ? <b className="text-ink">{email}</b> : "your email"}.
          Click it to activate your account &mdash; then we&rsquo;ll verify your mobile number.
        </>
      }
    >
      <ResendForm email={email} />
      <div className="mt-4 text-center text-[13px] text-ink-2">
        Already verified?{" "}
        <Link href="/login" className="font-bold text-brand">
          Log in
        </Link>
      </div>
    </AuthCard>
  );
}
