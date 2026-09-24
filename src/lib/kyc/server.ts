import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/types/database";
import { decryptField, encryptField, KycConfigError, last4 } from "./crypto";
import {
  ACCOUNT_RE,
  CONSENT_VERSION,
  IFSC_RE,
  KYC_DOCS_BUCKET,
  MAX_CERTIFICATIONS,
  PAN_RE,
  clean,
  cleanUpper,
  mask,
  type FieldErrors,
} from "./rules";

type Client = SupabaseClient<Database>;
type KycRow = Tables<"vendor_kyc">;

/** What the vendor's own browser is allowed to see: masked values only. */
export interface KycView {
  panMasked: string | null;
  registeredAddress: string | null;
  accountHolderName: string | null;
  bankAccountMasked: string | null;
  ifscMasked: string | null;
  cancelledChequePath: string | null;
  certificationPaths: string[];
  consentCurrent: boolean;
  consentAt: string | null;
  deletionRequestedAt: string | null;
}

export async function loadKycRow(supabase: Client, vendorId: string): Promise<KycRow | null> {
  const { data } = await supabase
    .from("vendor_kyc")
    .select("*")
    .eq("vendor_id", vendorId)
    .maybeSingle();
  return data;
}

export function toKycView(row: KycRow | null): KycView {
  return {
    panMasked: mask(row?.pan_last4),
    registeredAddress: row?.registered_address ?? null,
    accountHolderName: row?.account_holder_name ?? null,
    bankAccountMasked: mask(row?.bank_account_last4),
    ifscMasked: mask(row?.ifsc_last4),
    cancelledChequePath: row?.cancelled_cheque_path ?? null,
    certificationPaths: row?.certification_paths ?? [],
    consentCurrent: row?.consent_version === CONSENT_VERSION && !!row?.consent_at,
    consentAt: row?.consent_at ?? null,
    deletionRequestedAt: row?.deletion_requested_at ?? null,
  };
}


export interface PreparedKyc {
  row: Omit<KycRow, "created_at" | "updated_at">;
  changedFields: string[];
  removedPaths: string[];
  /** Decrypted PAN in effect after this save (for the GSTIN cross-check). */
  effectivePan: string | null;
  missingForSubmission: string[];
  consentGiven: boolean;
}

function isOwnPath(path: string, vendorId: string) {
  return path.startsWith(`${vendorId}/`) && !path.includes("..") && path.length < 300;
}

/**
 * Validates the sensitive part of a KYC form submission and builds the row
 * to store. Blank PAN / account / IFSC inputs mean "keep what is on file".
 * Nothing is written here.
 */
export function prepareKyc(
  formData: FormData,
  vendorId: string,
  existing: KycRow | null
): { errors: FieldErrors } | { prepared: PreparedKyc } {
  const errors: FieldErrors = {};

  const pan = cleanUpper(formData.get("pan"));
  const address = clean(formData.get("registered_address"));
  const holder = clean(formData.get("account_holder_name"));
  const account = clean(formData.get("bank_account_number")).replace(/\s+/g, "");
  const accountConfirm = clean(formData.get("bank_account_number_confirm")).replace(/\s+/g, "");
  const ifsc = cleanUpper(formData.get("ifsc_code"));
  const chequePath = clean(formData.get("cancelled_cheque_path")) || null;
  const certPaths = formData.getAll("certification_paths").map(clean).filter(Boolean);
  const consent = formData.get("consent") === "yes";

  if (pan && !PAN_RE.test(pan)) errors.pan = "PAN should look like ABCDE1234F.";
  if (address.length > 500) errors.registered_address = "Address is too long.";
  if (holder.length > 120) errors.account_holder_name = "Name is too long.";
  if (account) {
    if (!ACCOUNT_RE.test(account)) {
      errors.bank_account_number = "Account number should be 9 to 18 digits.";
    } else if (account !== accountConfirm) {
      errors.bank_account_number_confirm = "Account numbers don't match.";
    }
  }
  if (ifsc && !IFSC_RE.test(ifsc)) errors.ifsc_code = "IFSC should look like SBIN0001234.";
  if (chequePath && !isOwnPath(chequePath, vendorId)) errors.cancelled_cheque_path = "Invalid file.";
  if (certPaths.length > MAX_CERTIFICATIONS) {
    errors.certification_paths = `Upload at most ${MAX_CERTIFICATIONS} certificates.`;
  } else if (certPaths.some((p) => !isOwnPath(p, vendorId))) {
    errors.certification_paths = "Invalid file.";
  }

  const consentCurrent =
    existing?.consent_version === CONSENT_VERSION && !!existing?.consent_at;
  if (!consentCurrent && !consent) {
    errors.consent = "Please read the privacy notice and tick the box to continue.";
  }

  if (Object.keys(errors).length) return { errors };

  let panEnc = existing?.pan_enc ?? null;
  let panLast4 = existing?.pan_last4 ?? null;
  let accEnc = existing?.bank_account_enc ?? null;
  let accLast4 = existing?.bank_account_last4 ?? null;
  let ifscEnc = existing?.ifsc_enc ?? null;
  let ifscLast4 = existing?.ifsc_last4 ?? null;
  const changed: string[] = [];

  if (pan) {
    panEnc = encryptField(pan);
    panLast4 = last4(pan);
    changed.push("pan");
  }
  if (account) {
    accEnc = encryptField(account);
    accLast4 = last4(account);
    changed.push("bank_account_number");
  }
  if (ifsc) {
    ifscEnc = encryptField(ifsc);
    ifscLast4 = last4(ifsc);
    changed.push("ifsc_code");
  }
  if (address !== (existing?.registered_address ?? "")) changed.push("registered_address");
  if (holder !== (existing?.account_holder_name ?? "")) changed.push("account_holder_name");
  if (chequePath !== (existing?.cancelled_cheque_path ?? null)) changed.push("cancelled_cheque");
  const oldCerts = existing?.certification_paths ?? [];
  if (certPaths.join("|") !== oldCerts.join("|")) changed.push("certifications");

  const removedPaths = [
    ...(existing?.cancelled_cheque_path && existing.cancelled_cheque_path !== chequePath
      ? [existing.cancelled_cheque_path]
      : []),
    ...oldCerts.filter((p) => !certPaths.includes(p)),
  ];

  const row: PreparedKyc["row"] = {
    vendor_id: vendorId,
    pan_enc: panEnc,
    pan_last4: panLast4,
    registered_address: address || null,
    account_holder_name: holder || null,
    bank_account_enc: accEnc,
    bank_account_last4: accLast4,
    ifsc_enc: ifscEnc,
    ifsc_last4: ifscLast4,
    cancelled_cheque_path: chequePath,
    certification_paths: certPaths,
    consent_at: consentCurrent ? existing!.consent_at : new Date().toISOString(),
    consent_version: CONSENT_VERSION,
    deletion_requested_at: existing?.deletion_requested_at ?? null,
  };

  const missing: string[] = [];
  if (!row.pan_enc) missing.push("PAN");
  if (!row.registered_address) missing.push("registered address");
  if (!row.account_holder_name) missing.push("account holder name");
  if (!row.bank_account_enc) missing.push("bank account number");
  if (!row.ifsc_enc) missing.push("IFSC code");
  if (!row.cancelled_cheque_path) missing.push("cancelled cheque / passbook image");

  return {
    prepared: {
      row,
      changedFields: changed,
      removedPaths,
      effectivePan: pan || decryptField(existing?.pan_enc),
      missingForSubmission: missing,
      consentGiven: !consentCurrent,
    },
  };
}

export async function commitKyc(supabase: Client, prepared: PreparedKyc): Promise<boolean> {
  const { error } = await supabase
    .from("vendor_kyc")
    .upsert(prepared.row, { onConflict: "vendor_id" });
  if (error) {
    // Log the error code only — messages/details can echo submitted values.
    console.error("vendor_kyc upsert failed", error.code);
    return false;
  }
  if (prepared.removedPaths.length) {
    await supabase.storage.from(KYC_DOCS_BUCKET).remove(prepared.removedPaths);
  }
  if (prepared.consentGiven) {
    await logKycEvent(supabase, prepared.row.vendor_id, "consent", [CONSENT_VERSION]);
  }
  if (prepared.changedFields.length) {
    await logKycEvent(supabase, prepared.row.vendor_id, "update", prepared.changedFields);
  }
  return true;
}

export type KycAction =
  | "view"
  | "update"
  | "submit"
  | "document_view"
  | "deletion_request"
  | "consent";

export async function logKycEvent(
  supabase: Client,
  vendorId: string,
  action: KycAction,
  fields: string[] = []
) {
  const { error } = await supabase.rpc("log_kyc_event", {
    p_vendor_id: vendorId,
    p_action: action,
    p_fields: fields,
  });
  if (error) console.error("log_kyc_event failed", error.code);
}

/** GSTIN characters 3–12 are the business PAN. */
export function gstinMatchesPan(gstin: string, pan: string | null): boolean {
  return !pan || gstin.slice(2, 12) === pan;
}

/** Admin-only: decrypted values + short-lived document links. Logs the view. */
export async function loadKycForAdmin(supabase: Client, vendorId: string) {
  const row = await loadKycRow(supabase, vendorId);
  if (!row) return null;

  let decrypted: { pan: string | null; account: string | null; ifsc: string | null };
  let decryptError = false;
  try {
    decrypted = {
      pan: decryptField(row.pan_enc),
      account: decryptField(row.bank_account_enc),
      ifsc: decryptField(row.ifsc_enc),
    };
  } catch (e) {
    if (!(e instanceof KycConfigError)) console.error("KYC decrypt failed");
    decrypted = { pan: null, account: null, ifsc: null };
    decryptError = true;
  }

  const paths = [row.cancelled_cheque_path, ...row.certification_paths].filter(
    (p): p is string => !!p
  );
  const links = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage
      .from(KYC_DOCS_BUCKET)
      .createSignedUrls(paths, 300); // 5 minutes
    data?.forEach((d) => d.path && d.signedUrl && links.set(d.path, d.signedUrl));
  }

  await logKycEvent(supabase, vendorId, "view", [
    "pan",
    "bank_account_number",
    "ifsc_code",
    ...(paths.length ? ["documents"] : []),
  ]);

  return {
    row,
    ...decrypted,
    decryptError,
    chequeUrl: row.cancelled_cheque_path ? (links.get(row.cancelled_cheque_path) ?? null) : null,
    certificationUrls: row.certification_paths.map((p) => ({
      name: fileLabel(p),
      url: links.get(p) ?? null,
    })),
  };
}

/** Object paths look like {vendorId}/{timestamp}-{kind}-{originalName}. */
export function fileLabel(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/^\d+-(cheque|cert)-/, "");
}
