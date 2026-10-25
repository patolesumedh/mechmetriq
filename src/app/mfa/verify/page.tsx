import { AuthCard } from "@/components/auth/AuthCard";
import { logoutAction } from "@/lib/actions/auth";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/kyc/rules";
import { safeNextPath } from "@/lib/rawMaterials/format";
import { requireLanding } from "../_lib";
import { VerifyTotp } from "./VerifyTotp";

export const metadata = { title: "Two-factor login · MECHmetrIQ" };

export default async function MfaVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  await requireLanding("/mfa/verify");
  const next = safeNextPath((await searchParams).next);
  const resetting = next === "/reset-password";

  return (
    <AuthCard
      title={resetting ? "Confirm it's you" : "Enter your login code"}
      subtitle={
        resetting
          ? "Your account has two-factor login on, so changing the password also needs the 6-digit code from your authenticator app."
          : "Open your authenticator app and enter the 6-digit code for MECHmetrIQ."
      }
    >
      <VerifyTotp next={next} />
      <p className="mt-4 text-[12px] leading-relaxed text-muted">
        Lost your phone? Email{" "}
        <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="font-semibold text-brand">
          {PRIVACY_CONTACT_EMAIL}
        </a>{" "}
        from your registered address and we&rsquo;ll reset your two-factor login once we&rsquo;ve
        confirmed it&rsquo;s you.
      </p>
      <form action={logoutAction} className="mt-4 text-center text-[12.5px] text-ink-2">
        <button type="submit" className="font-semibold text-brand">
          Log out
        </button>
      </form>
    </AuthCard>
  );
}
