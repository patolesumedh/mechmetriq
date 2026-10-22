/**
 * Sign-up / password rules shared by the server actions. The same mobile and
 * GSTIN rules are enforced again in the database signup trigger
 * (supabase/migrations/0019_auth_account_security.sql), so a request that
 * skips these forms still can't create a bad account.
 */

/** "9876543210", "+91 98765 43210", "09876543210" → "9876543210"; else null. */
export function normalizeMobile(input: string | null | undefined): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return digits;
  if (/^(91|0)[6-9]\d{9}$/.test(digits)) return digits.slice(-10);
  return null;
}

/** E.164 form Supabase Auth expects for SMS, e.g. "+919876543210". */
export function toE164(mobile: string): string {
  return `+91${mobile}`;
}

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Format + mod-36 checksum of the 15th character. */
export function isValidGstin(input: string | null | undefined): boolean {
  const g = (input ?? "").trim().toUpperCase();
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) return false;
  let total = 0;
  for (let i = 0; i < 14; i++) {
    const product = GSTIN_CHARS.indexOf(g[i]) * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (total % 36)) % 36] === g[14];
}

export const PASSWORD_HINT =
  "At least 8 characters, with an uppercase letter, a lowercase letter and a number.";

/** Returns an error message, or null if the password meets the rules. */
export function passwordProblem(password: string, email?: string | null): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 72) return "Password must be at most 72 characters.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return `Password is too weak. ${PASSWORD_HINT}`;
  }
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) {
    return "Password must not contain your email address.";
  }
  return null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
