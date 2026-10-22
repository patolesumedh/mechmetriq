import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { logoutAction } from "@/lib/actions/auth";
import { requireMfaSetupAccess } from "../_lib";
import { EnrollTotp } from "./EnrollTotp";

export const metadata = { title: "Set up two-factor login · MECHmetrIQ" };

export default async function MfaSetupPage() {
  const { required } = await requireMfaSetupAccess();

  return (
    <AuthCard
      title="Set up two-factor login"
      subtitle={
        required
          ? "Admin accounts can see KYC documents and payments, so every admin login needs a code from an authenticator app as well as the password."
          : "After this, every login will ask for a code from your authenticator app as well as your password, so a stolen password alone can't get into your account."
      }
      width={440}
    >
      {/* Required setup lands on the dashboard via /login's status redirect. */}
      <EnrollTotp doneHref={required ? "/login" : "/account/security?msg=mfa_on"} />
      {required ? (
        <form action={logoutAction} className="mt-5 text-center text-[12.5px] text-ink-2">
          <button type="submit" className="font-semibold text-brand">
            Log out
          </button>
        </form>
      ) : (
        <div className="mt-5 text-center text-[12.5px]">
          <Link href="/account/security" className="font-semibold text-brand">
            Cancel
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
