import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { activateSubscription } from "@/lib/subscription/payment";

/**
 * POST /api/subscription/razorpay/webhook
 *
 * Razorpay webhook endpoint for asynchronous payment verification.
 * Handles payment.captured events to automatically activate
 * subscriptions even when the client-side verify call fails.
 *
 * Webhook Secret must be configured in Razorpay Dashboard →
 * Settings → Webhooks. Add as RAZORPAY_WEBHOOK_SECRET in .env.local.
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 }
    );
  }

  // Verify webhook signature
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing signature header" },
      { status: 400 }
    );
  }

  const rawBody = await request.text();
  const hmac = crypto.createHmac("sha256", webhookSecret);
  hmac.update(rawBody);
  const expectedSignature = hmac.digest("hex");

  if (signature !== expectedSignature) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  let event: {
    event: string;
    payload: {
      payment?: {
        entity?: {
          id: string;
          order_id: string;
          amount: number;
          status: string;
          notes?: Record<string, string>;
        };
      };
    };
  };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only handle payment.captured events
  if (event.event !== "payment.captured") {
    return NextResponse.json(
      { ok: true, message: "Event received but not processed" },
      { status: 200 }
    );
  }

  const payment = event.payload?.payment?.entity;
  if (!payment || !payment.notes?.account_id) {
    return NextResponse.json(
      { error: "Missing payment or account info" },
      { status: 400 }
    );
  }

  const accountId = payment.notes.account_id;
  // user_id may be in notes if set during order creation
  const userId = payment.notes.user_id ?? "webhook";
  const supabase = await createClient();

  try {
    // Check idempotency — has this payment already been processed?
    const { data: existingPayment } = await supabase
      .from("subscription_payment_logs")
      .select("id")
      .eq("razorpay_payment_id", payment.id)
      .maybeSingle();

    if (existingPayment) {
      // Already processed — idempotent
      return NextResponse.json(
        { ok: true, message: "Payment already processed" },
        { status: 200 }
      );
    }

    // Delegate to the same activateSubscription used by
    // the client-side verify route. No duplicated logic.
    const result = await activateSubscription(supabase, {
      accountId,
      userId,
      payment: {
        razorpay_order_id: payment.order_id,
        razorpay_payment_id: payment.id,
        razorpay_signature: "",
        amount: payment.amount / 100,
      },
    });

    if (!result.success) {
      console.error("[Razorpay Webhook] Activation failed:", result.error);
      return NextResponse.json(
        { error: result.error ?? "Failed to activate subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, message: "Subscription activated", subscription: result.subscription },
      { status: 200 }
    );
  } catch (err) {
    console.error("[Razorpay Webhook] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}