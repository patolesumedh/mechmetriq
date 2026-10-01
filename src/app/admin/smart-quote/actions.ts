"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/types/database";

type Cfg = Record<string, unknown>;

/** Walk the current config and overwrite every leaf that the form posted. */
function applyForm(node: unknown, path: string, form: FormData, errors: string[]): unknown {
  if (Array.isArray(node)) return node.map((v, i) => applyForm(v, `${path}.${i}`, form, errors));
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node as Cfg).map(([k, v]) => [k, applyForm(v, path ? `${path}.${k}` : k, form, errors)])
    );
  }
  const posted = form.get(path);
  if (posted === null) return node;
  if (typeof node === "number") {
    const n = Number(String(posted).trim());
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
      errors.push(path);
      return node;
    }
    return n;
  }
  return String(posted).trim().slice(0, 80) || node;
}

export async function saveSmartQuoteRatesAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/login");

  const { data: row } = await supabase.from("sq_settings").select("config").eq("id", 1).single();
  if (!row) redirect("/admin/smart-quote?error=missing");

  const errors: string[] = [];
  const config = applyForm(row.config, "", formData, errors);
  if (errors.length) redirect(`/admin/smart-quote?error=${encodeURIComponent(errors.slice(0, 5).join(","))}`);

  const { error } = await supabase
    .from("sq_settings")
    .update({ config: config as Json, updated_by: user.id })
    .eq("id", 1);
  if (error) redirect("/admin/smart-quote?error=save");
  revalidatePath("/admin/smart-quote");
  revalidatePath("/buyer/quote");
  redirect("/admin/smart-quote?saved=1");
}
