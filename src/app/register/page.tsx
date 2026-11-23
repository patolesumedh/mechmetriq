import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";
import { RegisterForm } from "./RegisterForm";

// If a visitor already has a valid session, send them straight to their
// dashboard instead of showing the account-creation form again.
export default async function RegisterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(await getDashboardPath(supabase, user.id));
  }

  return <RegisterForm />;
}
