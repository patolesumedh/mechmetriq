import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";
import { AuthCard } from "@/components/auth/AuthCard";
import { PENDING_EMAIL_COOKIE } from "./constants";
import { VerifyEmailForm } from "./VerifyEmailForm";

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
      title="Verify your email"
      subtitle={
        <>
          We sent a verification code to {email ? <b className="text-ink">{email}</b> : "your email"}.
          Enter it below &mdash; or click the link in the same email.
        </>
      }
    >
      <VerifyEmailForm email={email} />
      <div className="mt-3 text-center text-[13px] text-ink-2">
        Already verified?{" "}
        <Link href="/login" className="font-bold text-brand">
          Log in
        </Link>
      </div>
    </AuthCard>
  );
}
