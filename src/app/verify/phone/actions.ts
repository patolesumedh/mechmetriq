"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardPath } from "@/lib/auth/getDashboardPath";
import { normalizeMobile, toE164 } from "@/lib/auth/validation";

export interface PhoneState {
  stage: "enter" | "code";
  phone?: string;
  error?: string;
  notice?: string;
}

/**
 * One action for the whole mobile-verification flow, switched on `intent`:
 *   send   → Supabase texts a 6-digit code to the number (phone_change OTP)
 *   verify → checks the code; Supabase marks the number confirmed and the
 *            sync_auth_verification trigger sets profiles.phone_verified
 *   change → back to the number field
 * SMS delivery uses the phone provider configured in Supabase Auth.
 */
export async function phoneVerificationAction(
  prev: PhoneState,
  formData: FormData
): Promise<PhoneState> {
  const intent = String(formData.get("intent") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (intent === "change") return { stage: "enter", phone: prev.phone };

  if (intent === "send") {
    const raw = String(formData.get("phone") ?? "");
    const phone = normalizeMobile(raw);
    if (!phone) return { stage: "enter", phone: raw, error: "Enter a valid 10-digit Indian mobile number." };

    const { error } = await supabase.auth.updateUser({ phone: toE164(phone) });
    if (error) {
      const message =
        error.code === "phone_exists"
          ? "This mobile number is already verified on another MECHmetrIQ account."
          : error.code === "over_sms_send_rate_limit" || error.status === 429
            ? "Too many codes requested. Please wait a minute and try again."
            : error.code === "phone_provider_disabled" || error.code === "sms_send_failed"
              ? "We couldn't send an SMS right now. Please try again shortly or contact support."
              : error.message;
      return { stage: "enter", phone, error: message };
    }
    return { stage: "code", phone, notice: `We sent a 6-digit code to +91 ${phone}.` };
  }

  if (intent === "verify") {
    const phone = normalizeMobile(prev.phone);
    const token = String(formData.get("token") ?? "").replace(/\D/g, "");
    if (!phone) return { stage: "enter", error: "Enter your mobile number first." };
    if (token.length !== 6) return { stage: "code", phone, error: "Enter the 6-digit code." };

    const { error } = await supabase.auth.verifyOtp({ phone: toE164(phone), token, type: "phone_change" });
    if (error) {
      return {
        stage: "code",
        phone,
        error: error.code === "otp_expired" ? "That code is wrong or has expired. Request a new one." : error.message,
      };
    }
    redirect(await getDashboardPath(supabase, user.id));
  }

  return prev;
}
