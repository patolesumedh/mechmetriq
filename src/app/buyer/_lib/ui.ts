import type { BadgeTone } from "@/components/ui/Badge";
import type { Enums } from "@/lib/types/database";

/** Maps an RFQ status to the closest available Badge tone. */
export function rfqStatusTone(status: Enums<"rfq_status">): BadgeTone {
  switch (status) {
    case "pending":
      return "pending";
    case "quoted":
      return "quoted";
    case "accepted":
      return "accepted";
    case "expired":
    case "cancelled":
      return "lost";
    default:
      return "inactive";
  }
}

/** Maps an order status to the closest available Badge tone. */
export function orderStatusTone(status: Enums<"order_status">): BadgeTone {
  switch (status) {
    case "draft":
      return "inactive";
    case "quoted":
      return "quoted";
    case "accepted_paid":
      return "accepted";
    case "in_production":
      return "production";
    case "qc_ready":
      return "review";
    case "shipped":
      return "shipped";
    case "delivered":
      return "delivered";
    case "cancelled":
    case "refunded":
      return "lost";
    case "disputed":
      return "disputed";
    default:
      return "inactive";
  }
}

/** Maps a quote status to the closest available Badge tone. */
export function quoteStatusTone(status: Enums<"quote_status">): BadgeTone {
  switch (status) {
    case "submitted":
      return "new";
    case "won":
      return "won";
    case "lost":
    case "expired":
    case "withdrawn":
      return "lost";
    default:
      return "inactive";
  }
}

/** Maps a payment status to the closest available Badge tone. */
export function paymentStatusTone(status: Enums<"payment_status">): BadgeTone {
  switch (status) {
    case "success":
      return "approved";
    case "failed":
      return "rejected";
    case "refunded":
      return "lost";
    default:
      return "pending";
  }
}

/** Turns a snake_case status enum value into a human-readable label. */
export function statusLabel(status: string): string {
  if (status === "qc_ready") return "QC Ready";
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatCurrency(amount: number | null | undefined): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function initials(name: string | null | undefined): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return chars.join("") || "U";
}
