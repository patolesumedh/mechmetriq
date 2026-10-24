import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Supabase client for calls that email the user a link (sign-up, resend,
 * password reset). It uses the implicit flow instead of the default PKCE
 * flow: PKCE links only work in the browser that asked for the email, so
 * opening the link on a phone or inside the Gmail app failed. Implicit links
 * arrive with the session in the URL fragment, which /auth/confirm picks up
 * in whichever browser opens it.
 *
 * Holds no session itself; nothing it returns is stored in cookies.
 */
export function createEmailLinkClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
