import { AuthCard } from "@/components/auth/AuthCard";
import { logoutAction } from "@/lib/actions/auth";
import { requireLanding } from "../_lib";
import { EnrollTotp } from "./EnrollTotp";

export const metadata = { title: "Set up two-factor login · MECHmetrIQ" };

export default async function MfaSetupPage() {
  await requireLanding("/mfa/setup");

  return (
    <AuthCard
      title="Set up two-factor login"
      subtitle="Admin accounts can see KYC documents and payments, so every admin login needs a code from an authenticator app as well as the password."
      width={440}
    >
      <EnrollTotp />
      <form action={logoutAction} className="mt-5 text-center text-[12.5px] text-ink-2">
        <button type="submit" className="font-semibold text-brand">
          Log out
        </button>
      </form>
    </AuthCard>
  );
}
