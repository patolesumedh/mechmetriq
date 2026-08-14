import type { BadgeTone } from "@/components/ui/Badge";
import type { Database } from "@/lib/types/database";

/** Formats a number as an Indian Rupee currency string, e.g. ₹1,24,500. */
export function formatINR(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Formats an ISO date/timestamp string as e.g. "14 Aug 2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Formats an ISO date/timestamp string as e.g. "14 Aug 2026, 3:45 pm". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Derives up to two-letter initials from a name for avatar badges. */
export function initialsFor(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------
// Badge tone mappers — translate DB enum values onto the closest Badge
// tone defined in src/components/ui/Badge.tsx.
// ---------------------------------------------------------------------

export function kycTone(status: Database["public"]["Enums"]["kyc_status"]): BadgeTone {
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

export function orderStatusTone(
  status: Database["public"]["Enums"]["order_status"]
): BadgeTone {
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

export function rfqStatusTone(status: Database["public"]["Enums"]["rfq_status"]): BadgeTone {
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

export function quoteStatusTone(status: Database["public"]["Enums"]["quote_status"]): BadgeTone {
  switch (status) {
    case "submitted":
      return "new";
    case "won":
      return "won";
    case "lost":
    case "expired":
      return "lost";
    case "withdrawn":
      return "inactive";
    default:
      return "inactive";
  }
}

export function disputeTone(status: Database["public"]["Enums"]["dispute_status"]): BadgeTone {
  switch (status) {
    case "open":
      return "open";
    case "reviewing":
      return "review";
    case "resolved":
      return "approved";
    default:
      return "inactive";
  }
}

export function listingStatusTone(
  status: Database["public"]["Enums"]["listing_status"]
): BadgeTone {
  switch (status) {
    case "active":
      return "active";
    case "pending_review":
      return "pending";
    case "rejected":
      return "rejected";
    case "draft":
    case "inactive":
    default:
      return "inactive";
  }
}

export function masterStatusTone(
  status: Database["public"]["Enums"]["master_status"]
): BadgeTone {
  return status === "active" ? "active" : "inactive";
}

export function roleTone(role: Database["public"]["Enums"]["user_role"]): BadgeTone {
  switch (role) {
    case "admin":
      return "approved";
    case "vendor":
      return "quoted";
    case "buyer":
    default:
      return "new";
  }
}

export function vendorTypeTone(
  type: Database["public"]["Enums"]["vendor_type"]
): BadgeTone {
  return type === "fabrication" ? "quoted" : "production";
}

export function orderTypeTone(type: Database["public"]["Enums"]["order_type"]): BadgeTone {
  return type === "custom_part" ? "quoted" : "production";
}

export function paymentStatusTone(
  status: Database["public"]["Enums"]["payment_status"]
): BadgeTone {
  switch (status) {
    case "success":
      return "approved";
    case "pending":
      return "pending";
    case "failed":
      return "rejected";
    case "refunded":
      return "lost";
    default:
      return "inactive";
  }
}
