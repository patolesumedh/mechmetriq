import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, hasAdminClientConfig } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types/database";

const RazorpayWebhookSchema = z.object({
  entity: z.string().optional(),
  account_id: z.string().optional(),
  event: z.string().min(1).max(120),
  contains: z.array(z.string()).optional(),
  payload: z.record(z.string(), z.unknown()),
  created_at: z.number().int().optional(),
});

/**
 * Razorpay Webhook Handler (`/api/webhooks/razorpay`).
 *
 * Security controls (Section 3.9):
 * 1. Verifies `X-Razorpay-Signature` against the raw request body using
 *    `RAZORPAY_WEBHOOK_SECRET` in constant time (`400` on mismatch).
 * 2. Deduplicates deliveries by recording `event.id` (`x-razorpay-event-id`)
 *    in `public.payment_webhook_events` so the same event is never processed twice.
 * 3. Orders are only marked paid from verified server-side webhook/API verification,
 *    never from unverified browser callbacks.
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret || !hasAdminClientConfig()) {
    return new NextResponse("Webhook unconfigured", { status: 503 });
  }

  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!signature) {
    return new NextResponse("Missing signature", { status: 400 });
  }

  const rawBody = await req.text();
  const expectedHex = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expectedHex, "utf8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const validated = RazorpayWebhookSchema.safeParse(parsedJson);
  if (!validated.success) {
    return new NextResponse("Invalid webhook payload", { status: 400 });
  }

  const eventHeaderId = req.headers.get("x-razorpay-event-id")?.trim();
  const eventId =
    eventHeaderId ||
    `${validated.data.event}:${validated.data.created_at ?? Date.now()}:${createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex")
      .slice(0, 24)}`;

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("payment_webhook_events").insert({
    event_id: eventId,
    provider: "razorpay",
    event_type: validated.data.event,
    payload: validated.data.payload as unknown as Json,
    processed_at: new Date().toISOString(),
  });

  if (insertError) {
    // Postgres unique_violation (23505) means we already processed this exact event
    if (insertError.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    return new NextResponse("Failed to record webhook event", { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
