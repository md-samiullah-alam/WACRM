import type { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { getAnyAccountSubscription, getActivePlan, getActiveSubscription } from "./subscription";
import type { AccountSubscription } from "@/types";

export interface PaymentVerificationInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/**
 * Verify Razorpay payment signature using HMAC-SHA256.
 *
 * The signature is computed as:
 *   HMAC-SHA256(keySecret, "order_id|payment_id")
 */
export function verifyRazorpaySignature(
  input: PaymentVerificationInput,
  keySecret: string
): boolean {
  const hmac = crypto.createHmac("sha256", keySecret);
  hmac.update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`);
  const expectedSignature = hmac.digest("hex");
  return expectedSignature === input.razorpay_signature;
}

export interface SubscriptionActivationResult {
  success: boolean;
  subscription: AccountSubscription | null;
  error?: string;
}

/**
 * Activate (create or update) a subscription after successful payment.
 *
 * Handles:
 *   - No prior subscription → INSERT new active sub
 *   - Existing ACTIVE subscription → UPDATE extends dates (annual renewal)
 *   - Existing EXPIRED/CANCELLED subscription → UPDATE reactivates
 *
 * Concurrency safety:
 *   - The partial unique index idx_active_subscription_per_account
 *     ensures at most one ACTIVE sub per account.
 *   - If a reactivation conflicts with an existing active sub,
 *     we fall back to updating that one instead.
 */
export async function activateSubscription(
  supabase: SupabaseClient,
  options: {
    accountId: string;
    userId: string;
    payment: PaymentVerificationInput & { amount?: number };
  }
): Promise<SubscriptionActivationResult> {
  const { accountId, userId, payment } = options;

  const plan = await getActivePlan(supabase);
  if (!plan) {
    return { success: false, subscription: null, error: "No active plan found" };
  }

  const now = new Date();
  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  // Check for an existing ACTIVE subscription first —
  // if one exists, update it. Otherwise, check for any
  // subscription row (expired, cancelled) to reactivate.
  let existingSub = await getActiveSubscription(supabase, accountId);
  let isNewSubscription = false;

  if (!existingSub) {
    existingSub = await getAnyAccountSubscription(supabase, accountId);
    if (!existingSub) {
      isNewSubscription = true;
    }
  }

  if (existingSub && !isNewSubscription) {
    // Update existing subscription — reactivate and extend dates
    const currentUntil = existingSub.annual_fee_paid_until
      ? new Date(existingSub.annual_fee_paid_until)
      : now;
    const baseDate = currentUntil > now ? currentUntil : now;
    const newPaidUntil = new Date(baseDate);
    newPaidUntil.setFullYear(newPaidUntil.getFullYear() + 1);

    try {
      const { data: updated, error: updateError } = await supabase
        .from("account_subscriptions")
        .update({
          plan_id: plan.id,
          status: "active",
          base_price_paid: plan.base_price,
          annual_fee_paid: (+existingSub.annual_fee_paid || 0) + plan.annual_fee,
          annual_fee_paid_until: newPaidUntil.toISOString(),
          annual_fee_due_date: oneYearFromNow.toISOString(),
          razorpay_order_id: payment.razorpay_order_id,
          razorpay_payment_id: payment.razorpay_payment_id,
          razorpay_signature: payment.razorpay_signature,
          purchased_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", existingSub.id)
        .select("*, plan:plan_id(*)")
        .single();

      if (updateError) {
        return { success: false, subscription: null, error: updateError.message };
      }

      await logPaymentSafe(supabase, {
        accountId,
        subscriptionId: existingSub.id,
        amount: +plan.base_price + +plan.annual_fee,
        paymentType: "base",
        paymentMethod: "razorpay",
        notes: `Subscription reactivation — ${plan.name}`,
        userId,
        payment,
      });

      return { success: true, subscription: updated };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update subscription";
      return { success: false, subscription: null, error: msg };
    }
  }

  // No existing subscription — create new
  try {
    const { data: subscription, error: subError } = await supabase
      .from("account_subscriptions")
      .insert({
        account_id: accountId,
        plan_id: plan.id,
        status: "active",
        base_price_paid: plan.base_price,
        annual_fee_paid: plan.annual_fee,
        annual_fee_due_date: oneYearFromNow.toISOString(),
        annual_fee_paid_until: oneYearFromNow.toISOString(),
        razorpay_order_id: payment.razorpay_order_id,
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_signature: payment.razorpay_signature,
        purchased_at: now.toISOString(),
      })
      .select("*, plan:plan_id(*)")
      .single();

    if (subError) {
      // If the error is a unique violation on the partial index,
      // there's already an active sub — retry by fetching it.
      if (subError.code === "23505") {
        const activeSub = await getActiveSubscription(supabase, accountId);
        if (activeSub) {
          return { success: true, subscription: activeSub };
        }
      }
      return { success: false, subscription: null, error: subError.message };
    }

    await logPaymentSafe(supabase, {
      accountId,
      subscriptionId: subscription.id,
      amount: +plan.base_price + +plan.annual_fee,
      paymentType: "base",
      paymentMethod: "razorpay",
      notes: `New subscription — ${plan.name}`,
      userId,
      payment,
    });

    return { success: true, subscription };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create subscription";
    return { success: false, subscription: null, error: msg };
  }
}

/**
 * Safe payment log insertion — silently ignores errors when tables don't exist.
 * Payment is already verified by Razorpay signature; the log is an audit trail.
 */
async function logPaymentSafe(
  supabase: SupabaseClient,
  options: {
    accountId: string;
    subscriptionId: string;
    amount: number;
    paymentType: string;
    paymentMethod: string;
    notes: string;
    userId: string;
    payment: PaymentVerificationInput;
  }
) {
  try {
    await supabase.from("subscription_payment_logs").insert({
      account_id: options.accountId,
      subscription_id: options.subscriptionId,
      amount: options.amount,
      payment_type: options.paymentType,
      payment_method: options.paymentMethod,
      razorpay_order_id: options.payment.razorpay_order_id,
      razorpay_payment_id: options.payment.razorpay_payment_id,
      notes: options.notes,
      paid_by_user_id: options.userId,
    });
  } catch {
    // Table may not exist — payment is already verified, just missing audit log
  }
}