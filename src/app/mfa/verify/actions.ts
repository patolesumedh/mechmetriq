"use server";

import { createClient } from "@/lib/supabase/server";
import { checkAuthRateLimit } from "@/lib/security/rateLimit";

export async function checkMfaVerifyRateLimitAction(): Promise<{ allowed: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return checkAuthRateLimit(user?.email ?? user?.id);
}
