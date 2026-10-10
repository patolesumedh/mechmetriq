/** Client-safe formatting helpers for the Raw Material Marketplace. */

export function inr(amount: number | null | undefined, paise = false): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: paise ? 2 : 0,
    maximumFractionDigits: paise ? 2 : 0,
  }).format(amount);
}

export function kg(weight: number | null | undefined): string {
  if (weight === null || weight === undefined || Number.isNaN(weight)) return "—";
  const dp = weight < 10 ? 3 : weight < 1000 ? 2 : 1;
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: dp }).format(weight)} kg`;
}

export function num(value: number, dp = 2): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: dp }).format(value);
}

export const FAMILY_LABELS: Record<string, string> = {
  bar: "Bars",
  flat: "Sheets, plates & coils",
  pipe: "Pipes, tubes & hollow sections",
  section: "Structural sections",
  wire: "Wire",
};

export const FAMILY_ORDER = ["bar", "flat", "pipe", "section", "wire"];

/** Buyer-facing label for a raw-material order status. */
export function rmStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Awaiting approval";
    case "quoted":
      return "Approved · payment due";
    case "accepted_paid":
      return "Paid";
    case "in_production":
      return "Being prepared";
    case "qc_ready":
      return "Ready to dispatch";
    case "shipped":
      return "Dispatched";
    case "delivered":
      return "Delivered";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "refunded":
      return "Refunded";
    case "disputed":
      return "Disputed";
    default:
      return status;
  }
}

/** Only relative, same-site paths are allowed as post-login destinations. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (value.length > 300) return null;
  return value;
}
