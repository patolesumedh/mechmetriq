"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/guard";
import { createAdminClient, hasAdminClientConfig } from "@/lib/supabase/admin";
import { createEmailLinkClient } from "@/lib/supabase/emailLinks";
import { siteUrl } from "@/lib/auth/siteUrl";
import { isValidEmail } from "@/lib/auth/validation";
import type { Database } from "@/lib/types/database";

type Role = Database["public"]["Enums"]["user_role"];
const ROLES: Role[] = ["buyer", "vendor", "admin"];

const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);

/** Suspend (soft delete: ends all their sessions, blocks sign-in) or reactivate. */
export async function setAccountStatusAction(formData: FormData) {
  const supabase = await requireAdminSession();
  const userId = String(formData.get("userId") ?? "");
  const status = formData.get("status") === "suspended" ? "suspended" : "active";
  const reason = str(formData, "reason", 300);
  const back = String(formData.get("back") ?? "") === "detail" ? `/admin/users/${userId}` : "/admin/users";

  const { error } = await supabase.rpc("admin_set_account_status", {
    p_user_id: userId,
    p_status: status,
    p_reason: reason || undefined,
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  const q = error ? `msg=error&detail=${encodeURIComponent(error.message)}` : `msg=${status}`;
  redirect(`${back}?${q}`);
}

/**
 * Creates an account of any role. The person gets a "set your password"
 * email (the normal reset-password link), so the admin never handles
 * passwords. Admins must still set up an authenticator app at first sign-in.
 */
export async function createUserAction(formData: FormData) {
  const supabase = await requireAdminSession();
  const fail = (m: string): never => redirect(`/admin/users/new?error=${encodeURIComponent(m)}`);

  if (!hasAdminClientConfig()) fail("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.");

  const role = str(formData, "role") as Role;
  const fullName = str(formData, "full_name", 120);
  const email = str(formData, "email", 200).toLowerCase();
  const phone = str(formData, "phone", 20);
  const vendorType = str(formData, "vendor_type");
  const companyName = str(formData, "company_name", 200);
  const gstin = str(formData, "gstin", 15).toUpperCase();

  if (!ROLES.includes(role)) fail("Choose a role.");
  if (!fullName) fail("Full name is required.");
  if (!isValidEmail(email)) fail("Enter a valid email address.");
  if (role === "vendor") {
    if (!companyName) fail("Company name is required for vendors.");
    if (vendorType !== "fabrication" && vendorType !== "raw_material") fail("Choose a vendor type.");
  }

  // One-time token that tells the sign-up trigger this account is admin-made.
  const { data: token, error: inviteError } = await supabase.rpc("admin_create_user_invite", {
    p_email: email,
    p_role: role,
  });
  if (inviteError || !token) fail(inviteError?.message ?? "Couldn't create the account.");

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone: phone || undefined,
      role,
      admin_invite_token: token,
      ...(role === "vendor"
        ? { vendor_type: vendorType, company_name: companyName, gstin: gstin || undefined }
        : {}),
    },
  });
  if (error || !created.user) {
    fail(
      /already (been )?registered|exists/i.test(error?.message ?? "")
        ? "An account with this email already exists."
        : error?.message ?? "Couldn't create the account."
    );
  }

  // Email them a link to choose their password.
  const mailer = createEmailLinkClient();
  const { error: mailError } = await mailer.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteUrl()}/auth/callback?next=/reset-password`,
  });

  revalidatePath("/admin/users");
  redirect(`/admin/users/${created.user!.id}?msg=${mailError ? "created_nomail" : "created"}`);
}

/** Edits name, email, phone and role. Guardrails live in admin_update_user(). */
export async function updateUserAction(formData: FormData) {
  const supabase = await requireAdminSession();
  const userId = str(formData, "userId", 64);
  const fail = (m: string): never =>
    redirect(`/admin/users/${userId}?error=${encodeURIComponent(m)}`);

  const fullName = str(formData, "full_name", 120);
  const email = str(formData, "email", 200).toLowerCase();
  const phone = str(formData, "phone", 20);
  const role = str(formData, "role") as Role;
  if (!ROLES.includes(role)) fail("Choose a role.");
  if (!isValidEmail(email)) fail("Enter a valid email address.");

  const { data: current } = await supabase.from("profiles").select("email").eq("id", userId).single();
  if (!current) fail("User not found.");

  const { error } = await supabase.rpc("admin_update_user", {
    p_user_id: userId,
    p_full_name: fullName,
    p_phone: phone,
    p_role: role,
  });
  if (error) fail(error.message);

  // Email lives in Supabase Auth; the sync trigger copies it to profiles.
  if (email !== current!.email.toLowerCase()) {
    if (!hasAdminClientConfig()) fail("Saved, but the email can't change: SUPABASE_SERVICE_ROLE_KEY is not configured.");
    const { error: emailError } = await createAdminClient().auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    });
    if (emailError) {
      fail(
        /already|exists/i.test(emailError.message)
          ? "Saved, but that email already belongs to another account."
          : `Saved, but the email couldn't change: ${emailError.message}`
      );
    }
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  redirect(`/admin/users/${userId}?msg=saved`);
}
