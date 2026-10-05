"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface AddToCartState {
  ok?: boolean;
  error?: string;
  needsLogin?: boolean;
  /** increments on every successful add so the client can reset/flash */
  added?: number;
}

export async function addToCartAction(prev: AddToCartState, formData: FormData): Promise<AddToCartState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { needsLogin: true, error: "Log in as a buyer to add items to your cart." };

  const shapeId = String(formData.get("shape_id") ?? "");
  const gradeId = String(formData.get("grade_id") ?? "");
  let dims: Record<string, number>;
  try {
    const parsed = JSON.parse(String(formData.get("dims") ?? "{}"));
    dims = Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, v]) => typeof v === "number" || (typeof v === "string" && v.trim() !== ""))
        .map(([k, v]) => [k, Number(v)])
    );
  } catch {
    return { error: "Please check the dimensions." };
  }
  const lengthRaw = String(formData.get("length_mm") ?? "").trim();
  const length = lengthRaw === "" ? null : Number(lengthRaw);
  const quantity = Number(formData.get("quantity"));
  const mtc = formData.get("mtc") === "on";
  const notes = String(formData.get("notes") ?? "").slice(0, 500);

  const { error } = await supabase.rpc("rm_add_to_cart", {
    p_shape_id: shapeId,
    p_grade_id: gradeId,
    p_dims: dims,
    // RPC accepts SQL NULL for shapes without a length dimension even though
    // the generated type marks this param as required (it has no SQL default).
    p_length_mm: length as number,
    p_quantity: quantity,
    p_mtc: mtc,
    p_notes: notes || undefined, // RPC default is null; generated type only allows omitting it
  });
  if (error) return { error: error.message };

  revalidatePath("/raw-materials", "layout");
  revalidatePath("/buyer/cart");
  return { ok: true, added: (prev.added ?? 0) + 1 };
}
