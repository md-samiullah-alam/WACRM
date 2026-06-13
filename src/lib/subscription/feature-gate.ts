/**
 * ============================================================
 * Feature Gate — Centralized Access Control
 *
 * Every premium action in the system MUST call `canUseFeature()`
 * before proceeding. This is the single source of truth for
 * subscription/trial validation — no other file should duplicate
 * this logic.
 *
 * States handled:
 *   - New user (trial active)
 *   - Active trial user
 *   - Trial expired user
 *   - Active subscriber
 *   - Expired subscriber
 *
 * Thread-safe for both client and server contexts.
 * ============================================================
 */

import type { SubscriptionState } from "@/types";

export interface FeatureGateResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check whether a user can use premium features.
 *
 * @param state - The full subscription state from /api/subscription/state
 * @returns {FeatureGateResult} with `allowed: boolean` and optional `reason`
 *
 * Usage:
 *   const gate = canUseFeature(subscriptionState);
 *   if (!gate.allowed) {
 *     showPaywallModal(gate.reason);
 *     return;
 *   }
 */
export function canUseFeature(state: SubscriptionState | null): FeatureGateResult {
  // Safety: no state means loading — block access
  if (!state) {
    return { allowed: false, reason: "Subscription state not loaded yet." };
  }

  // Active subscriber always has access
  if (state.subscription?.status === "active") {
    return { allowed: true };
  }

  // Active trial — full access
  if (state.inTrial) {
    return { allowed: true };
  }

  // Trial expired, no active subscription
  if (!state.inTrial && !state.hasFeatureAccess) {
    return {
      allowed: false,
      reason: "Your 7-day free trial has expired. Purchase the Yearly Plan to continue using all features.",
    };
  }

  // Fallback catch-all — block
  return {
    allowed: false,
    reason: "Purchase the Yearly Plan to use all features.",
  };
}

/**
 * Server-side check: verify the account has feature access.
 * Uses the `hasFeatureAccess` state boolean computed server-side.
 *
 * This is a convenience wrapper for the state API response.
 * All API routes should check `state.hasFeatureAccess` from
 * the subscription state endpoint or call the RPC function
 * `has_feature_access(account_id)` directly.
 */
export function hasPremiumAccess(state: SubscriptionState | null): boolean {
  if (!state) return false;
  return state.hasFeatureAccess;
}

/**
 * Determine the exact subscription status for display purposes.
 * Returns a human-readable status string.
 */
export type SubscriptionStatusLabel =
  | "trial"
  | "active"
  | "expired"
  | "trial-expired"
  | "pending";

export function getSubscriptionStatusLabel(state: SubscriptionState | null): SubscriptionStatusLabel {
  if (!state) return "pending";

  if (state.subscription?.status === "active") return "active";
  if (state.inTrial) return "trial";
  if (!state.inTrial && !state.hasFeatureAccess) return "trial-expired";
  return "expired";
}