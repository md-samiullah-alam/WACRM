import type { SupabaseClient } from "@supabase/supabase-js";

export const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface TrialInfo {
  inTrial: boolean;
  trialStartedAt: string | null;
  trialSecondsRemaining: number;
  trialExpired: boolean;
}

/**
 * Get the trial state for an account.
 *
 * The trial is considered "active" when:
 *   1. trial_started_at is set on the accounts row
 *   2. The current time is within 7 days of trial_started_at
 *
 * The trial is NOT active when:
 *   1. trial_started_at is NULL (shouldn't happen after migration 024)
 *   2. More than 7 days have passed since trial_started_at
 *
 * IMPORTANT: There is NO mechanism to reset the trial.
 * The trial_started_at is set ONCE at account creation
 * (via the handle_new_user DB trigger) and never modified.
 * Refreshing the page or restarting the app cannot bypass this.
 */
export async function getTrialState(
  supabase: SupabaseClient,
  accountId: string
): Promise<TrialInfo> {
  const { data: account, error } = await supabase
    .from("accounts")
    .select("trial_started_at")
    .eq("id", accountId)
    .single();

  // If the account row is missing, something is very wrong —
  // return no trial state and let the caller handle it.
  if (error || !account) {
    return {
      inTrial: false,
      trialStartedAt: null,
      trialSecondsRemaining: 0,
      trialExpired: true,
    };
  }

  // If trial_started_at is NULL, the account was created before
  // migration 024 updated the handle_new_user trigger. The
  // migration backfills this, so this should be rare/transient.
  if (!account.trial_started_at) {
    return {
      inTrial: false,
      trialStartedAt: null,
      trialSecondsRemaining: 0,
      trialExpired: true,
    };
  }

  const now = Date.now();
  const trialStart = new Date(account.trial_started_at).getTime();
  const trialEnd = trialStart + TRIAL_DURATION_MS;

  // Trial has expired
  if (now >= trialEnd) {
    return {
      inTrial: false,
      trialStartedAt: account.trial_started_at,
      trialSecondsRemaining: 0,
      trialExpired: true,
    };
  }

  // Trial is active
  return {
    inTrial: true,
    trialStartedAt: account.trial_started_at,
    trialSecondsRemaining: Math.ceil((trialEnd - now) / 1000),
    trialExpired: false,
  };
}

/**
 * Format remaining trial seconds into a human-readable string.
 * Examples: "45s", "2m 30s", "4m 59s"
 */
export function formatTrialTime(seconds: number): string {
  if (seconds <= 0) return "0s";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}
