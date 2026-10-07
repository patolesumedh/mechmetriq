/** A confirmed Smart Quote price is held for this many days (enforced in sq_pay_quote). */
export const QUOTE_VALID_DAYS = 7;

/** Validity window of a confirmed price; `expired` is evaluated per request on the server. */
export function quoteValidity(confirmedAt: string | null) {
  if (!confirmedAt) return { validUntil: null, expired: false };
  const validUntil = new Date(new Date(confirmedAt).getTime() + QUOTE_VALID_DAYS * 86_400_000);
  return { validUntil: validUntil.toISOString(), expired: validUntil.getTime() < Date.now() };
}
