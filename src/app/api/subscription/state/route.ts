import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { SubscriptionState } from "@/types";
import { getTrialState } from "@/lib/subscription/trial";
import { getAccountSubscription } from "@/lib/subscription/subscription";

/**
 * GET /api/subscription/state
 *
 * Returns the full subscription state for the authenticated user's account.
 * This is the single source of truth for all subscription/trial UI decisions.
 *
 * The `hasFeatureAccess` field combines trial + active subscription.
 * All feature gates MUST use this field — never compute access independently.
 */
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile?.account_id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const accountId = profile.account_id;

  // Fetch trial and subscription state in parallel
  const [trial, subscription] = await Promise.all([
    getTrialState(supabase, accountId),
    getAccountSubscription(supabase, accountId),
  ]);

  const isActiveSub = subscription?.status === "active";

  // hasFeatureAccess is the central gate: trial OR active subscription.
  // Every premium feature MUST check this field before proceeding.
  const hasFeatureAccess = trial.inTrial || isActiveSub;

  // hasAnnualSupportAccess gates customization/development/support features.
  // Only available when subscription is active AND annual fee is paid.
  const hasAnnualSupportAccess =
    isActiveSub &&
    subscription?.annual_fee_paid_until != null &&
    new Date(subscription.annual_fee_paid_until) > new Date();

  const state: SubscriptionState = {
    inTrial: trial.inTrial,
    trialSecondsRemaining: trial.trialSecondsRemaining,
    trialStartedAt: trial.trialStartedAt,
    hasFeatureAccess,
    hasAnnualSupportAccess,
    subscription: subscription ?? null,
  };

  // Prevent caching — subscription state must always be fresh
  return NextResponse.json(
    { state },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  );
}