import "server-only";
import { redirect } from "next/navigation";
import { requireAccountFor } from "@/lib/auth/guard";
import type { Tables } from "@/lib/types/database";
import { parseRemarks, portalsFor, PORTAL_LABEL, type CorrectionRemarks, type Portal } from "./status";

/**
 * Shared by both vendor layouts: checks the user may be in this portal,
 * loads their vendor profile and, for "both" vendors, the link to the other
 * portal (F5.6).
 */
export async function loadVendorPortal(portal: Portal) {
  // Until KYC is approved, only the KYC / onboarding pages are reachable (see guard).
  const { supabase, user } = await requireAccountFor(portal);

  const { data: vendor } = await supabase
    .from("vendor_profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!vendor || !portalsFor(vendor.vendor_type).includes(portal)) redirect("/login");

  const other = portalsFor(vendor.vendor_type).find((p) => p !== portal);
  const switcher = other
    ? {
        label: `Switch to ${PORTAL_LABEL[other]} portal`,
        href: vendor.kyc_status === "approved" ? `/vendor/${other}` : `/vendor/${other}/onboarding`,
      }
    : undefined;

  return { supabase, user, vendor, switcher };
}

/** Remarks from the latest "Correction required" review, if that's the current status (F5.4). */
export async function loadCorrections(
  supabase: Awaited<ReturnType<typeof loadVendorPortal>>["supabase"],
  vendor: Tables<"vendor_profiles">
): Promise<{ remarks: CorrectionRemarks; at: string | null }> {
  if (vendor.kyc_status !== "correction_required") return { remarks: {}, at: null };
  const { data } = await supabase
    .from("vendor_kyc_reviews")
    .select("remarks, created_at")
    .eq("vendor_id", vendor.id)
    .eq("action", "correction_requested")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { remarks: parseRemarks(data?.remarks), at: data?.created_at ?? null };
}
