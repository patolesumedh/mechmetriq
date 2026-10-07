/**
 * MECHmetriQ Pay — TEST MODE gateway.
 *
 * A simulated payment gateway so the buyer can complete a purchase end to
 * end before a real gateway (e.g. Razorpay) is integrated. No money moves.
 * The outcome is decided by the test credentials below, mirroring how real
 * gateways behave in their sandbox mode.
 *
 * Safe to import from client and server code.
 */

export type PayMethod = "upi" | "card" | "netbanking" | "wallet";

export const PAY_METHODS: PayMethod[] = ["upi", "card", "netbanking", "wallet"];

export const PAY_METHOD_LABEL: Record<PayMethod, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Netbanking",
  wallet: "Wallet",
};

/** Test credentials shown to the buyer inside the gateway. */
export const TEST_CREDENTIALS = {
  upiSuccess: "success@mmq",
  upiFailure: "failure@mmq",
  cardSuccess: "4111 1111 1111 1111",
  cardDeclined: "4000 0000 0000 0002",
  otpHint: "any 6 digits (000000 fails)",
};

export const BANKS = [
  { code: "SBIN", name: "State Bank of India", short: "SBI", color: "#22409a" },
  { code: "HDFC", name: "HDFC Bank", short: "HDFC", color: "#004c8f" },
  { code: "ICIC", name: "ICICI Bank", short: "ICICI", color: "#ae282e" },
  { code: "UTIB", name: "Axis Bank", short: "Axis", color: "#97144d" },
  { code: "KKBK", name: "Kotak Mahindra Bank", short: "Kotak", color: "#ed1c24" },
  { code: "PUNB", name: "Punjab National Bank", short: "PNB", color: "#a20a3a" },
  { code: "BARB", name: "Bank of Baroda", short: "BoB", color: "#f15a22" },
  { code: "YESB", name: "Yes Bank", short: "Yes", color: "#0a3a7a" },
] as const;

export const OTHER_BANKS = [
  "Bank of India",
  "Canara Bank",
  "Central Bank of India",
  "Federal Bank",
  "IDBI Bank",
  "IDFC FIRST Bank",
  "IndusInd Bank",
  "Indian Bank",
  "Union Bank of India",
];

export const WALLETS = [
  { code: "paytm", name: "Paytm", color: "#00baf2" },
  { code: "phonepe", name: "PhonePe", color: "#5f259f" },
  { code: "amazonpay", name: "Amazon Pay", color: "#232f3e" },
  { code: "mobikwik", name: "MobiKwik", color: "#2a6ef0" },
] as const;

// --- Card helpers --------------------------------------------------------

export function digitsOnly(s: string) {
  return s.replace(/\D/g, "");
}

export function cardBrand(num: string): "Visa" | "Mastercard" | "RuPay" | "Amex" | null {
  const d = digitsOnly(num);
  if (/^3[47]/.test(d)) return "Amex";
  if (/^(60|65|81|82|508|353|356)/.test(d)) return "RuPay";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
  if (/^4/.test(d)) return "Visa";
  return null;
}

export function formatCardNumber(raw: string) {
  const d = digitsOnly(raw).slice(0, 19);
  if (cardBrand(d) === "Amex") {
    return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(" ");
  }
  return d.replace(/(.{4})/g, "$1 ").trim();
}

export function luhnValid(num: string) {
  const d = digitsOnly(num);
  if (d.length < 12 || d.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (dbl) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export function formatExpiry(raw: string) {
  const d = digitsOnly(raw).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
}

export function expiryValid(exp: string, now = new Date()) {
  const d = digitsOnly(exp);
  if (d.length !== 4) return false;
  const m = Number(d.slice(0, 2));
  const y = 2000 + Number(d.slice(2));
  if (m < 1 || m > 12) return false;
  return y > now.getFullYear() || (y === now.getFullYear() && m >= now.getMonth() + 1);
}

export function isDeclinedTestCard(num: string) {
  return digitsOnly(num) === digitsOnly(TEST_CREDENTIALS.cardDeclined);
}

export const VPA_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

/** Gateway-style reference, e.g. pay_TEST_Q4mZ8kP2xLw9Rt. */
export function newPaymentRef() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  return "pay_TEST_" + Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function isTestPaymentRef(ref: string | null | undefined) {
  return !!ref && ref.startsWith("pay_TEST_");
}
