import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthCard } from "@/components/auth/AuthCard";
import { VENDOR_TYPE_LABEL } from "@/lib/kyc/status";
import { AcceptInviteForm } from "./AcceptInviteForm";

export const metadata = { title: "Vendor invitation · MECHmetrIQ" };

const PROBLEM: Record<string, { title: string; text: string }> = {
  expired: { title: "This invitation has expired", text: "Invitation links work for 72 hours. Ask the MECHmetrIQ team to resend it." },
  revoked: { title: "This invitation was withdrawn", text: "Contact the MECHmetrIQ team if you think this is a mistake." },
  accepted: { title: "This invitation has already been used", text: "Log in with the account you created." },
  invalid: { title: "Invitation not found", text: "Check that you opened the full link from your invitation." },
};

/** Public page behind an admin's vendor invitation link (F5.5). */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data: rows }, { data: { user } }] = await Promise.all([
    supabase.rpc("vendor_invite_lookup", { p_token: token }),
    supabase.auth.getUser(),
  ]);
  const invite = rows?.[0];
  const status = invite?.status ?? "invalid";

  if (status !== "valid" || !invite) {
    const p = PROBLEM[status] ?? PROBLEM.invalid;
    return (
      <AuthCard title={p.title} subtitle={p.text} width={460}>
        <Link href="/login" className="block w-full rounded-[9px] bg-brand py-3 text-center text-[14.5px] font-bold text-white">
          Go to login
        </Link>
      </AuthCard>
    );
  }

  if (user) {
    return (
      <AuthCard
        title="You're already logged in"
        subtitle={`Log out first, then open the invitation link again to register ${invite.company_name}.`}
        width={460}
      >
        <Link href="/login" className="block w-full rounded-[9px] border border-grid py-3 text-center text-[14px] font-bold text-ink-2">
          Back
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={`Join MECHmetrIQ as a vendor`}
      subtitle={
        <>
          You&rsquo;ve been invited to register <b className="text-ink">{invite.company_name}</b> as a{" "}
          <b className="text-ink">{VENDOR_TYPE_LABEL[invite.vendor_type]}</b> vendor. Check the details, set a
          password, then verify your email and complete KYC.
        </>
      }
      width={560}
    >
      <AcceptInviteForm
        token={token}
        invite={{
          email: invite.email,
          contact_name: invite.contact_name,
          company_name: invite.company_name,
          phone: invite.phone,
          gstin: invite.gstin,
        }}
      />
    </AuthCard>
  );
}
