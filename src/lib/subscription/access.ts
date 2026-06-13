import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccountSubscription } from "./subscription";
import { getTrialState, type TrialInfo, TRIAL_DURATION_MS } from "./trial";

export type FeatureAccessReason = "trial_active" | "subscription_active" | "trial_expired" | "no_access";

export interface AccessResult {
  granted: boolean;
  reason: FeatureAccessReason;
  trial: TrialInfo | null;
  subscription: Awaited<ReturnType<typeof getAccountSubscription>>;
}

/**
 * Centralized access check — used by both server API routes and
 * client-side hooks. Returns whether the account can use premium features.
 */
export async function checkFeatureAccess(
  supabase: SupabaseClient,
  accountId: string
): Promise<AccessResult> {
  const [trial, subscription] = await Promise.all([
    getTrialState(supabase, accountId),
    getAccountSubscription(supabase, accountId),
  ]);

  // Trial active — full access
  if (trial.inTrial) {
    return { granted: true, reason: "trial_active", trial, subscription };
  }

  // Active subscription — full access
  if (subscription && subscription.status === "active") {
    return { granted: true, reason: "subscription_active", trial, subscription };
  }

  // No access — trial expired or no subscription
  const reason: FeatureAccessReason = trial.trialStartedAt ? "trial_expired" : "no_access";

  return { granted: false, reason, trial, subscription };
}
