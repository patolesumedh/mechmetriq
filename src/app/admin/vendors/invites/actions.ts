"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth/guard";
import { siteUrl } from "@/lib/auth/siteUrl";
import { isValidEmail, isValidGstin, normalizeMobile } from "@/lib/auth/validation";
import type { Database } from "@/lib/types/database";

/** How long an invitation link works (F5.5). */
const INVITE_TTL_HOURS = 72;

export interface InviteState {
  error?: string;
  /** Shown once, right after create/resend — only a hash of the token is stored. */
  link?: string;
  email?: string;
  company?: string;
}

const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);

function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

function expiry() {
  return new Date(Date.now() + INVITE_TTL_HOURS * 3600 * 1000).toISOString();
}

export async function createInviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const supabase = await requireAdminSession();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = str(formData, "email").toLowerCase();
  const vendorType = str(formData, "vendor_type", 20) as Database["public"]["Enums"]["vendor_type"];
  const contactName = str(formData, "contact_name", 120);
  const companyName = str(formData, "company_name");
  const rawPhone = str(formData, "phone", 20);
  const phone = rawPhone ? normalizeMobile(rawPhone) : null;
  const gstin = str(formData, "gstin", 15).toUpperCase();

  if (!["fabrication", "raw_material", "both"].includes(vendorType)) return { error: "Choose a vendor type." };
  if (!contactName) return { error: "Contact name is required." };
  if (!companyName) return { error: "Company name is required." };
  if (!isValidEmail(email)) return { error: "Enter a valid email address." };
  if (rawPhone && !phone) return { error: "Enter a valid 10-digit Indian mobile number, or leave it blank." };
  if (gstin && !isValidGstin(gstin)) return { error: "Enter a valid 15-character GSTIN, or leave it blank." };

  const { data: existing } = await supabase.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (existing) return { error: "An account with this email already exists." };

  const { token, hash } = newToken();
  const { error } = await supabase.from("vendor_invites").insert({
    token_hash: hash,
    email,
    vendor_type: vendorType,
    contact_name: contactName,
    company_name: companyName,
    phone,
    gstin: gstin || null,
    expires_at: expiry(),
    created_by: user?.id ?? null,
  });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "There's already an open invitation for this email. Resend or revoke it below."
          : "Couldn't create the invitation.",
    };
  }

  revalidatePath("/admin/vendors/invites");
  return { link: `${await siteUrl()}/invite/${token}`, email, company: companyName };
}

/** New link + fresh 72-hour expiry; the old link stops working. */
export async function resendInviteAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const supabase = await requireAdminSession();
  const id = str(formData, "id", 64);
  const { data: inv } = await supabase.from("vendor_invites").select("*").eq("id", id).maybeSingle();
  if (!inv || inv.accepted_at || inv.revoked_at) return { error: "This invitation can't be resent." };

  const { token, hash } = newToken();
  const { error } = await supabase
    .from("vendor_invites")
    .update({
      token_hash: hash,
      expires_at: expiry(),
      last_sent_at: new Date().toISOString(),
      send_count: inv.send_count + 1,
    })
    .eq("id", id);
  if (error) return { error: "Couldn't resend the invitation." };

  revalidatePath("/admin/vendors/invites");
  return { link: `${await siteUrl()}/invite/${token}`, email: inv.email, company: inv.company_name };
}

export async function revokeInviteAction(formData: FormData) {
  const supabase = await requireAdminSession();
  await supabase
    .from("vendor_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", str(formData, "id", 64))
    .is("accepted_at", null);
  revalidatePath("/admin/vendors/invites");
}
