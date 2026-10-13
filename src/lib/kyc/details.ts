import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/types/database";
import {
  EMAIL_RE,
  INDUSTRIES,
  INSPECTION_TOOLS,
  TOLERANCE_OPTIONS,
  URL_RE,
  clean,
  type FieldErrors,
  type VendorKind,
} from "./rules";

type Client = SupabaseClient<Database>;
export type DetailsRow = Tables<"vendor_details">;
export type DetailsInput = Omit<DetailsRow, "created_at" | "updated_at">;

/**
 * Business profile, facility & operations and capability details
 * (onboarding journey steps 2–4). Stored in vendor_details, which only the
 * vendor and admins can read.
 */
export async function loadDetailsRow(supabase: Client, vendorId: string): Promise<DetailsRow | null> {
  const { data } = await supabase
    .from("vendor_details")
    .select("*")
    .eq("vendor_id", vendorId)
    .maybeSingle();
  return data;
}

function int(
  formData: FormData,
  name: string,
  errors: FieldErrors,
  max: number,
  label: string
): number | null {
  const raw = clean(formData.get(name)).replace(/,/g, "");
  if (!raw) return null;
  if (!/^\d+$/.test(raw) || Number(raw) > max) {
    errors[name] = `${label} should be a whole number${max < 1e9 ? ` up to ${max.toLocaleString("en-IN")}` : ""}.`;
    return null;
  }
  return Number(raw);
}

function text(formData: FormData, name: string, errors: FieldErrors, max: number): string | null {
  const v = clean(formData.get(name));
  if (v.length > max) errors[name] = `Please keep this under ${max} characters.`;
  return v || null;
}

export function prepareDetails(
  formData: FormData,
  vendorId: string,
  existing: DetailsRow | null,
  kind: VendorKind
): { errors: FieldErrors } | { row: DetailsInput; missing: string[] } {
  const errors: FieldErrors = {};
  const thisYear = new Date().getFullYear();

  const yearRaw = clean(formData.get("year_established"));
  let year: number | null = null;
  if (yearRaw) {
    year = Number(yearRaw);
    if (!/^\d{4}$/.test(yearRaw) || year < 1900 || year > thisYear) {
      errors.year_established = `Enter a year between 1900 and ${thisYear}.`;
      year = null;
    }
  }

  let website = clean(formData.get("website"));
  if (website) {
    if (!URL_RE.test(website) || website.length > 200) errors.website = "Enter a valid website, e.g. www.example.com.";
    else if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
  }

  const businessEmail = clean(formData.get("business_email")).toLowerCase();
  if (businessEmail && (!EMAIL_RE.test(businessEmail) || businessEmail.length > 200)) {
    errors.business_email = "Enter a valid email address.";
  }

  const pick = (name: string, allowed: string[]) =>
    formData.getAll(name).map(String).filter((v) => allowed.includes(v));

  const tolerance = clean(formData.get("tolerance_capability"));
  if (tolerance && !TOLERANCE_OPTIONS.includes(tolerance)) errors.tolerance_capability = "Pick an option from the list.";

  const row: DetailsInput = {
    vendor_id: vendorId,
    trade_name: text(formData, "trade_name", errors, 200),
    year_established: year,
    website: website || null,
    business_email: businessEmail || null,
    facility_locations: text(formData, "facility_locations", errors, 500),
    facility_count: int(formData, "facility_count", errors, 999, "Number of facilities"),
    facility_area_sqft: int(formData, "facility_area_sqft", errors, 100_000_000, "Facility area"),
    employee_count: int(formData, "employee_count", errors, 1_000_000, "Employees"),
    working_hours: text(formData, "working_hours", errors, 200),
    production_capacity: text(formData, "production_capacity", errors, 300),
    serviceable_geography: text(formData, "serviceable_geography", errors, 300),
    // Capability fields belong to one vendor type; keep the other type's values untouched.
    machines: existing?.machines ?? null,
    max_job_size: existing?.max_job_size ?? null,
    tolerance_capability: existing?.tolerance_capability ?? null,
    industries: existing?.industries ?? [],
    inspection_capability: existing?.inspection_capability ?? [],
    brands: existing?.brands ?? null,
    stock_locations: existing?.stock_locations ?? null,
    supply_capacity: existing?.supply_capacity ?? null,
    delivery_locations: existing?.delivery_locations ?? null,
  };

  if (kind === "fabrication") {
    row.machines = text(formData, "machines", errors, 1000);
    row.max_job_size = text(formData, "max_job_size", errors, 200);
    row.tolerance_capability = tolerance || null;
    row.industries = pick("industries", INDUSTRIES);
    row.inspection_capability = pick("inspection_capability", INSPECTION_TOOLS);
  } else {
    row.brands = text(formData, "brands", errors, 500);
    row.stock_locations = text(formData, "stock_locations", errors, 500);
    row.supply_capacity = text(formData, "supply_capacity", errors, 300);
    row.delivery_locations = text(formData, "delivery_locations", errors, 500);
  }

  if (Object.keys(errors).length) return { errors };

  const missing: string[] = [];
  if (!row.year_established) missing.push("year of establishment");
  if (!row.business_email) missing.push("business email");

  return { row, missing };
}

export async function commitDetails(supabase: Client, row: DetailsInput): Promise<boolean> {
  const { error } = await supabase.from("vendor_details").upsert(row, { onConflict: "vendor_id" });
  if (error) console.error("vendor_details upsert failed", error.code);
  return !error;
}
