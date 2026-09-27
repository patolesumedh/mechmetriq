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
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const dashboard = await getDashboardPath(supabase, user.id);
    redirect(nextPath && dashboard === "/buyer" ? nextPath : dashboard);
  }

  return <LoginForm next={nextPath} />;
}
