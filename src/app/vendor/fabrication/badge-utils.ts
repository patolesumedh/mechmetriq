import type { BadgeTone } from "@/components/ui/Badge";
import type { Enums } from "@/lib/types/database";

export function orderStatusTone(status: Enums<"order_status">): BadgeTone {
  switch (status) {
    case "draft":
      return "pending";
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
    case "disputed":
      return "disputed";
    case "cancelled":
    case "refunded":
    default:
      return "inactive";
  }
}

export function orderStatusLabel(status: Enums<"order_status">): string {
  switch (status) {
    case "accepted_paid":
      return "Accepted / Paid";
    case "in_production":
      return "In Production";
    case "qc_ready":
      return "QC Ready";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export function rfqStatusTone(status: Enums<"rfq_status">): BadgeTone {
  switch (status) {
    case "pending":
      return "new";
    case "quoted":
      return "quoted";
    case "accepted":
      return "accepted";
    case "expired":
    case "cancelled":
    default:
      return "inactive";
  }
}

export function quoteStatusTone(status: Enums<"quote_status">): BadgeTone {
  switch (status) {
    case "submitted":
      return "quoted";
    case "won":
      return "won";
    case "lost":
      return "lost";
    case "expired":
    case "withdrawn":
    default:
      return "inactive";
  }
}

export function payoutStatusTone(status: Enums<"payout_status">): BadgeTone {
  switch (status) {
    case "paid":
      return "delivered";
    case "processing":
      return "production";
    case "pending":
    default:
      return "pending";
  }
}

export function kycStatusTone(status: Enums<"kyc_status">): BadgeTone {
  switch (status) {
    case "approved":
      return "approved";
    case "pending":
      return "review";
    case "rejected":
      return "rejected";
    case "on_hold":
      return "inactive";
    case "draft":
    default:
      return "pending";
  }
}

const ORDER_FORWARD_TRANSITIONS: Partial<Record<Enums<"order_status">, Enums<"order_status">>> = {
  accepted_paid: "in_production",
  in_production: "qc_ready",
  qc_ready: "shipped",
};

export function nextOrderStatus(current: Enums<"order_status">): Enums<"order_status"> | null {
  return ORDER_FORWARD_TRANSITIONS[current] ?? null;
}

export function formatINR(amount: number | null | undefined): string {
  const value = amount ?? 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
