import type { BadgeTone } from "@/components/ui/Badge";
import type { Database } from "@/lib/types/database";

/** Formats a number as an Indian Rupee amount, e.g. ₹1,23,456. */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Formats an ISO date/timestamp string as e.g. "14 Aug 2026". */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type ListingStatus = Database["public"]["Enums"]["listing_status"];
type OrderStatus = Database["public"]["Enums"]["order_status"];
type KycStatus = Database["public"]["Enums"]["kyc_status"];
type PayoutStatus = Database["public"]["Enums"]["payout_status"];

export function listingStatusTone(status: ListingStatus): BadgeTone {
  switch (status) {
    case "active":
      return "active";
    case "pending_review":
      return "review";
    case "rejected":
      return "rejected";
    case "draft":
    case "inactive":
    default:
      return "inactive";
  }
}

export function listingStatusLabel(status: ListingStatus): string {
  switch (status) {
    case "pending_review":
      return "Pending Review";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export function orderStatusTone(status: OrderStatus): BadgeTone {
  switch (status) {
    case "accepted_paid":
      return "accepted";
    case "in_production":
    case "qc_ready":
      return "production";
    case "shipped":
      return "shipped";
    case "delivered":
      return "delivered";
    case "quoted":
      return "quoted";
    case "disputed":
      return "disputed";
    case "cancelled":
    case "refunded":
      return "rejected";
    case "draft":
    default:
      return "inactive";
  }
}

export function orderStatusLabel(status: OrderStatus): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function kycStatusTone(status: KycStatus): BadgeTone {
  switch (status) {
    case "approved":
      return "approved";
    case "pending":
      return "pending";
    case "rejected":
      return "rejected";
    case "on_hold":
      return "review";
    case "draft":
    default:
      return "inactive";
  }
}

export function payoutStatusTone(status: PayoutStatus): BadgeTone {
  switch (status) {
    case "paid":
      return "approved";
    case "processing":
      return "review";
    case "pending":
    default:
      return "pending";
  }
}

export function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
