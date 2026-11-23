/** Session timeout rules (F1.6), shared by src/proxy.ts and the auth actions. */

/** Signed out after this long without a request. */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
/** With "Remember me" ticked at login. */
export const REMEMBER_IDLE_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000;

export const LAST_SEEN_COOKIE = "mmq_last_seen";
export const REMEMBER_COOKIE = "mmq_remember";
