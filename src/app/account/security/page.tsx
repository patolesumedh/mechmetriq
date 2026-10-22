import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";
import { AuthCard, AuthNotice } from "@/components/auth/AuthCard";
import { IDLE_TIMEOUT_MS } from "@/lib/auth/sessionPolicy";
import { revokeSessionAction, signOutOthersAction } from "./actions";

export const metadata = { title: "Account security · MECHmetrIQ" };

/** "Chrome on Windows" from a user-agent string; good enough for a list. */
function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "Browser";
  const os =
    /Windows/.test(ua) ? "Windows"
    : /Android/.test(ua) ? "Android"
    : /iPhone|iPad/.test(ua) ? "iOS"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "unknown OS";
  return `${browser} on ${os}`;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export default async function AccountSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const { msg } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const home = await getDashboardPath(supabase, user.id);
  if (home === "/account/suspended" || home.startsWith("/verify/") || home.startsWith("/mfa/")) redirect(home);

  const [{ data: sessions }, { data: factors }] = await Promise.all([
    supabase.rpc("my_sessions"),
    supabase.auth.mfa.listFactors(),
  ]);
  const totp = factors?.totp ?? [];
  const others = (sessions ?? []).filter((s) => !s.is_current).length;

  return (
    <AuthCard title="Account security" subtitle={user.email} width={620}>
      {msg === "revoked" && <AuthNotice>That session has been signed out.</AuthNotice>}
      {msg === "others" && <AuthNotice>All your other sessions have been signed out.</AuthNotice>}

      <section className="mb-6">
        <h2 className="mb-1 text-[14px] font-bold">Password</h2>
        <p className="mb-2 text-[12.5px] text-ink-2">Changing it signs you out on every other device.</p>
        <Link href="/reset-password" className="text-[13px] font-semibold text-brand">
          Change password &rarr;
        </Link>
      </section>

      <section className="mb-6">
        <h2 className="mb-1 text-[14px] font-bold">Two-factor login</h2>
        <p className="text-[12.5px] text-ink-2">
          {totp.length > 0
            ? `On — authenticator app added ${when(totp[0].created_at)}.`
            : "Off. Required for admin accounts."}
        </p>
      </section>

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[14px] font-bold">Where you&rsquo;re signed in</h2>
          {others > 0 && (
            <form action={signOutOthersAction}>
              <button type="submit" className="text-[12.5px] font-semibold text-[#a12525]">
                Sign out all other sessions
              </button>
            </form>
          )}
        </div>
        <p className="mb-3 text-[12px] text-muted">
          Sessions end after {IDLE_TIMEOUT_MS / 60000} minutes of inactivity unless you ticked
          &ldquo;Remember me&rdquo;. Don&rsquo;t recognise one? Sign it out and change your password.
        </p>
        <ul className="divide-y divide-grid rounded-lg border border-grid">
          {(sessions ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold">
                  {describeDevice(s.user_agent)}
                  {s.is_current && (
                    <span className="ml-2 rounded-full bg-brand-light px-2 py-px text-[10.5px] font-bold text-brand-dark">
                      This device
                    </span>
                  )}
                </div>
                <div className="truncate text-[11.5px] text-muted">
                  {s.ip ?? "Unknown IP"} · last active {when(s.last_active_at)} · signed in {when(s.created_at)}
                </div>
              </div>
              {!s.is_current && (
                <form action={revokeSessionAction}>
                  <input type="hidden" name="sessionId" value={s.id} />
                  <button type="submit" className="whitespace-nowrap rounded-lg border border-grid px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:bg-crit-bg hover:text-[#a12525]">
                    Sign out
                  </button>
                </form>
              )}
            </li>
          ))}
          {(sessions ?? []).length === 0 && (
            <li className="px-3.5 py-3 text-[12.5px] text-muted">No active sessions found.</li>
          )}
        </ul>
      </section>

      <Link href={home} className="text-[13px] font-semibold text-brand">
        &larr; Back to dashboard
      </Link>
    </AuthCard>
  );
}
