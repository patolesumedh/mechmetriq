import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";
import { safeNextPath } from "@/lib/rawMaterials/format";
import { LoginForm } from "./LoginForm";

// If a visitor already has a valid session (e.g. they clicked the logo from
// inside their dashboard, landed on the marketing site, and came back to
// /login), send them straight to their dashboard instead of making them
// re-enter their credentials.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string; error?: string }>;
}) {
  const { next, reason, error } = await searchParams;
  const nextPath = safeNextPath(next);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const dashboard = await getDashboardPath(supabase, user.id);
    redirect(nextPath && dashboard === "/buyer" ? nextPath : dashboard);
  }

  const notice =
    reason === "idle"
      ? "You were signed out after a period of inactivity. Please log in again."
      : error === "link"
        ? // Usually a sign-up link opened on another device or browser: Supabase
          // has already confirmed the email, only the automatic sign-in failed.
          "If you just clicked a verification link, your email is confirmed — log in to continue."
        : null;

  return <LoginForm next={nextPath} notice={notice} />;
}
