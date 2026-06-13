"use client";

import { useSubscription } from "@/hooks/use-subscription";
import { canUseFeature, getSubscriptionStatusLabel } from "@/lib/subscription/feature-gate";
import { formatTrialTime } from "@/lib/subscription/trial";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Check, Clock, Crown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function PlansPage() {
  const {
    state,
    loading,
    plans,
    plansLoading,
    openPaymentPage,
  } = useSubscription();
  const router = useRouter();
  const [purchasing, setPurchasing] = useState(false);
  const [renewing, setRenewing] = useState(false);

  const yearlyPlan = plans[0];

  const yearlyFeatures = yearlyPlan && Array.isArray(yearlyPlan.features)
    ? yearlyPlan.features
    : [
        "WhatsApp Shared Inbox",
        "Contact Management",
        "Sales Pipelines & Deals",
        "Broadcast Messaging",
        "No-Code Automations",
        "Flow Builder",
        "Message Templates",
        "Custom Fields & Tags",
        "Account Sharing (Multi-User)",
        "Customization & New Development",
        "Priority Email Support",
        "Software Updates",
      ];

  const trialFeatures = [
    "All features unlocked",
    "5 minutes full access",
    "No credit card required",
    "Auto-activated on signup",
  ];

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      await openPaymentPage("initial");
    } finally {
      setPurchasing(false);
    }
  };

  const handleRenew = async () => {
    setRenewing(true);
    try {
      await openPaymentPage("annual");
    } finally {
      setRenewing(false);
    }
  };

  if (loading || plansLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Use centralized gate for status
  const gate = canUseFeature(state);
  const statusLabel = getSubscriptionStatusLabel(state);
  const isInTrial = statusLabel === "trial";
  const trialSeconds = state?.trialSecondsRemaining ?? 0;
  const hasActiveSub = state?.subscription?.status === "active";
  const hasAnnualSupport = state?.hasAnnualSupportAccess ?? false;
  const planName = state?.subscription?.plan?.name ?? "Yearly Plan";

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-white mb-3">
          Plans & Pricing
        </h1>
        <p className="text-slate-400 max-w-xl mx-auto">
          Choose the plan that fits your business. Upgrade anytime — even
          during your free trial.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* ======================================== */}
        {/* FREE TRIAL CARD */}
        {/* ======================================== */}
        <Card
          className={`border-slate-800 bg-slate-900 ${
            isInTrial ? "ring-2 ring-blue-500/50" : ""
          }`}
        >
          <CardHeader className="text-center pb-3">
            <div className="flex justify-center mb-3">
              <Clock
                className={`h-10 w-10 ${
                  isInTrial ? "text-blue-400" : "text-slate-500"
                }`}
              />
            </div>
            <CardTitle className="text-xl text-white flex items-center justify-center gap-2">
              Free Trial
              {isInTrial && (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
                  Active
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              Try all features free for 5 minutes
            </CardDescription>
            <div className="mt-4">
              <span className="text-3xl font-bold text-white">FREE</span>
              <span className="text-slate-400 text-sm ml-1">for 5 minutes</span>
            </div>
          </CardHeader>

          <CardContent>
            <ul className="space-y-2">
              {trialFeatures.map((feat, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-300">{feat}</span>
                </li>
              ))}
            </ul>
          </CardContent>

          <CardFooter>
            {isInTrial ? (
              <div className="w-full text-center">
                <Button disabled className="w-full">
                  <Clock className="h-4 w-4 mr-2" />
                  Active — {formatTrialTime(trialSeconds)} left
                </Button>
                <p className="text-xs text-slate-500 mt-2">
                  Auto-activated on signup. No credit card needed.
                </p>
              </div>
            ) : (
              <div className="w-full text-center">
                <p className="text-sm text-slate-500">
                  {hasActiveSub
                    ? "Trial completed — you're on the Yearly Plan."
                    : "Trial has ended."}
                </p>
              </div>
            )}
          </CardFooter>
        </Card>

        {/* ======================================== */}
        {/* YEARLY PLAN CARD */}
        {/* ======================================== */}
        <Card
          className={`border-slate-800 bg-slate-900 ${
            hasActiveSub && !isInTrial ? "ring-2 ring-primary/50" : ""
          }`}
        >
          <CardHeader className="text-center pb-3">
            <div className="flex justify-center mb-3">
              <Crown
                className={`h-10 w-10 ${
                  hasActiveSub && !isInTrial
                    ? "text-primary"
                    : "text-slate-500"
                }`}
              />
            </div>
            <CardTitle className="text-xl text-white flex items-center justify-center gap-2">
              Yearly Plan
              {hasActiveSub && !isInTrial && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Active
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              Full access forever with annual maintenance
            </CardDescription>

            {yearlyPlan ? (
              <div className="mt-4 space-y-1">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-bold text-white">
                    ₹{yearlyPlan.base_price.toLocaleString()}
                  </span>
                  <span className="text-slate-400 text-sm">one-time</span>
                </div>
                <div className="text-slate-400 text-sm">
                  + ₹{yearlyPlan.annual_fee.toLocaleString()}/year
                </div>
                <div className="text-slate-500 text-xs">
                  maintenance, customization, development & support
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl font-bold text-white">
                    ₹1
                  </span>
                  <span className="text-slate-400 text-sm">one-time</span>
                </div>
                <div className="text-slate-400 text-sm">
                  + ₹1/year
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent>
            <ul className="space-y-2">
              {yearlyFeatures.map((feat: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-300">{feat}</span>
                </li>
              ))}
            </ul>
          </CardContent>

          <CardFooter className="flex flex-col gap-2">
            {hasActiveSub && !isInTrial ? (
              <>
                <Button disabled className="w-full">
                  <Crown className="h-4 w-4 mr-2" />
                  Plan Active — Base Fee Paid
                </Button>

                {hasAnnualSupport ? (
                  <>
                    <div className="text-center text-xs text-emerald-400/80 w-full">
                      Annual support active until{" "}
                      {state?.subscription?.annual_fee_paid_until
                        ? new Date(
                            state.subscription.annual_fee_paid_until
                          ).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "N/A"}
                    </div>
                    <Button
                      onClick={handleRenew}
                      disabled={renewing}
                      variant="outline"
                      className="w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      {renewing
                        ? "Processing..."
                        : "Extend Support — ₹10,000/year"}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="text-center text-xs text-amber-400/80 w-full">
                      Annual support has expired. Renew for customization &
                      updates.
                    </div>
                    <Button
                      onClick={handleRenew}
                      disabled={renewing}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      {renewing
                        ? "Processing..."
                        : "Renew Support — ₹10,000/year"}
                    </Button>
                  </>
                )}
              </>
            ) : (
              <Button
                onClick={handlePurchase}
                disabled={purchasing}
                className="w-full h-11 text-base bg-primary hover:bg-primary/90"
              >
                {purchasing
                  ? "Opening Checkout..."
                  : `Pay ₹${yearlyPlan?.base_price?.toLocaleString() ?? "20,000"} — Buy Now`}
              </Button>
            )}

            {isInTrial && !hasActiveSub && (
              <p className="text-xs text-slate-500 text-center mt-1">
                You can buy now even during your trial.
              </p>
            )}
          </CardFooter>
        </Card>
      </div>

      <div className="text-center mt-8 space-y-1">
        <p className="text-slate-500 text-xs">
          One-time ₹20,000 unlocks all core features forever.
        </p>
        <p className="text-slate-500 text-xs">
          ₹10,000/year covers customization, new development & support.
          If not renewed, customization features lock — core features stay
          active.
        </p>
        <p className="text-slate-600 text-xs mt-3">
          🔒 Payments secured by Razorpay
        </p>
      </div>
    </div>
  );
}