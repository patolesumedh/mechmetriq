import "server-only";
import { createHash } from "node:crypto";

/**
 * Leaked-password protection (F1.4). Checks the password against the
 * Have I Been Pwned corpus using k-anonymity: only the first 5 hex chars of
 * the SHA-1 hash leave the server, never the password or its full hash.
 *
 * Fails open (returns false) if the service is unreachable, so an outage
 * can't block sign-ups or password resets.
 */
export async function isPasswordLeaked(password: string): Promise<boolean> {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [s, count] = line.trim().split(":");
      return s === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}

export const LEAKED_PASSWORD_MESSAGE =
  "This password has appeared in a known data breach. Please choose a different one.";
