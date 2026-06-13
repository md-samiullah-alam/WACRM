"use client";

import { useSubscription } from "@/hooks/use-subscription";
import { useAuth } from "@/hooks/use-auth";
import { getSubscriptionStatusLabel } from "@/lib/subscription/feature-gate";
import { AlertTriangle, Clock, Crown } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

/**
 * Trial/Subscription banner displayed at the top of the dashboard.
 *
 * States:
 *   1. Active subscription with annual support → green "Plan Active" banner
 *   2. Active subscription, annual support expired → amber "Renew" banner
 *   3. Active trial → blue (or red when < 60s) countdown banner
 *   4. Trial expired, no subscription → red "Trial ended" banner
 *   5. Loading → nothing (prevents flash)
 */
export function TrialBanner() {
  const { state, loading } = useSubscription();
  const { account } = useAuth();
  const [displaySeconds, setDisplaySeconds] = useState(0);

  // Client-side countdown timer — syncs with server time via state.trialSecondsRemaining
  useEffect(() => {
    if (!state?.inTrial) return;
    setDisplaySeconds(state.trialSecondsRemaining);

    const interval = setInterval(() => {
      setDisplaySeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [state?.inTrial, state?.trialSecondsRemaining]);

  // Don't render anything while loading — avoid flash of wrong state
  if (loading || !state) return null;

  const statusLabel = getSubscriptionStatusLabel(state);

  // === STATE 1: Active subscription with annual support ===
  if (state.subscription && state.hasAnnualSupportAccess) {
    return (
      <div className="flex items-center gap-2 bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 text-sm">
        <Crown className="h-4 w-4 text-emerald-400 flex-shrink-0" />
        <span className="text-emerald-300">
          <span className="font-medium">{state.subscription.plan?.name ?? "Active"}</span>{" "}
          Plan — All features unlocked. Annual support active.
        </span>
        {state.subscription.annual_fee_paid_until && (
          <span className="text-emerald-400/70 text-xs ml-auto">
            Support until{" "}
            {new Date(
              state.subscription.annual_fee_paid_until
            ).toLocaleDateString()}
          </span>
        )}
      </div>
    );
  }

  // === STATE 2: Active subscription, annual support expired ===
  if (state.subscription && !state.hasAnnualSupportAccess) {
    return (
      <div className="flex items-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
        <span className="text-amber-300">
          <span className="font-medium">
            {state.subscription.plan?.name ?? "Active"}
          </span>{" "}
          Plan — Annual support/customization fee is due. Renew to unlock
          customization & updates.
        </span>
        <Link
          href="/plans"
          className="ml-auto text-amber-400 hover:text-amber-300 font-medium text-xs underline"
        >
          Renew Now
        </Link>
      </div>
    );
  }

  // === STATE 3: Active trial (inTrial === true) ===
  if (state.inTrial) {
    const isUrgent = displaySeconds <= 60;

    return (
      <div
        className={`flex items-center gap-2 border-b px-4 py-2 text-sm ${
          isUrgent
            ? "bg-red-500/10 border-red-500/20"
            : "bg-blue-500/10 border-blue-500/20"
        }`}
      >
        <Clock
          className={`h-4 w-4 flex-shrink-0 ${
            isUrgent ? "text-red-400" : "text-blue-400"
          }`}
        />
        <span
          className={isUrgent ? "text-red-300" : "text-blue-300"}
        >
          <span className="font-medium">
            {formatTime(displaySeconds)}
          </span>{" "}
          left in your free trial
          {account?.name ? ` — ${account.name}` : ""}.
        </span>
        <Link
          href="/plans"
          className={`ml-auto font-medium text-xs underline ${
            isUrgent
              ? "text-red-400 hover:text-red-300"
              : "text-blue-400 hover:text-blue-300"
          }`}
        >
          Choose Plan
        </Link>
      </div>
    );
  }

  // === STATE 4: Trial expired, no subscription ===
  if (statusLabel === "trial-expired" || statusLabel === "expired") {
    return (
      <div className="flex items-center gap-2 bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
        <span className="text-red-300">
          <span className="font-medium">Trial ended.</span> Your 5-minute
          free trial has expired. Features are locked until you purchase a plan.
        </span>
        <Link
          href="/plans"
          className="ml-auto text-red-400 hover:text-red-300 font-medium text-xs underline"
        >
          View Plans
        </Link>
      </div>
    );
  }

  // === STATE 5: Fallback — shouldn't normally reach here ===
  return null;
}