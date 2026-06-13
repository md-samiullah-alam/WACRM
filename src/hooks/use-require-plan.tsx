"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useSubscription } from "./use-subscription";
import { canUseFeature } from "@/lib/subscription/feature-gate";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check, Crown, Lock, X } from "lucide-react";
import type { SubscriptionState } from "@/types";

interface PlanGateContextValue {
  requirePlan: () => boolean;
  showPurchaseModal: () => void;
  hidePurchaseModal: () => void;
  modalOpen: boolean;
}

const PlanGateContext = createContext<PlanGateContextValue | null>(null);

export function PlanGateProvider({ children }: { children: ReactNode }) {
  const { state, loading, openPaymentPage } = useSubscription();
  const [modalOpen, setModalOpen] = useState(false);

  const showPurchaseModal = useCallback(() => setModalOpen(true), []);
  const hidePurchaseModal = useCallback(() => setModalOpen(false), []);

  /**
   * Centralized access gate. Uses `canUseFeature()` from the
   * feature-gate module — the single source of truth for all
   * subscription/trial validation.
   *
   * When a feature is blocked, it shows the purchase/paywall modal
   * and returns false so the caller can abort the action.
   */
  const requirePlan = useCallback((): boolean => {
    if (loading) return false;

    const gate = canUseFeature(state);
    if (gate.allowed) return true;

    // Blocked — show paywall modal
    setModalOpen(true);
    return false;
  }, [state, loading]);

  const handlePurchase = useCallback(() => {
    openPaymentPage("initial");
    hidePurchaseModal();
    toast.success("Opening Razorpay checkout...");
  }, [openPaymentPage, hidePurchaseModal]);

  return (
    <PlanGateContext.Provider
      value={{
        requirePlan,
        showPurchaseModal,
        hidePurchaseModal,
        modalOpen,
      }}
    >
      {children}

      <PurchaseModalOverlay
        open={modalOpen}
        onClose={hidePurchaseModal}
        onPurchase={handlePurchase}
        state={state}
      />
    </PlanGateContext.Provider>
  );
}

export function useRequirePlan(): PlanGateContextValue {
  const ctx = useContext(PlanGateContext);
  if (!ctx) {
    // Fallback for components rendered outside the provider —
    // allow everything (gates fail open) to avoid blocking
    // development/pages that don't need the gate.
    return {
      requirePlan: () => true,
      showPurchaseModal: () => {},
      hidePurchaseModal: () => {},
      modalOpen: false,
    };
  }
  return ctx;
}

/**
 * Paywall modal — shown when a user without access tries to use a
 * premium feature.
 */
function PurchaseModalOverlay({
  open,
  onClose,
  onPurchase,
  state,
}: {
  open: boolean;
  onClose: () => void;
  onPurchase: () => void;
  state: SubscriptionState | null;
}) {
  const [purchasing, setPurchasing] = useState(false);

  if (!open) return null;

  const handleBuy = () => {
    setPurchasing(true);
    onPurchase();
    // Don't reset purchasing — Razorpay will redirect
    // the user and the modal will unmount.
  };

  const getMessage = () => {
    const gate = canUseFeature(state);
    if (!gate.allowed && gate.reason) {
      return gate.reason;
    }
    if (!state) return "Loading subscription status...";

    return "Purchase the Yearly Plan to use all features.";
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      />
      <div className="relative z-[61] w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6 pb-4 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Lock className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white mb-1">
            Unlock This Feature
          </h2>
          <p className="text-slate-400 text-sm">
            {getMessage()}
          </p>
        </div>

        <div className="px-6 pb-6">
          <div className="rounded-xl border border-primary/30 bg-slate-800/50 p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <Crown className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-semibold text-white">Yearly Plan</h3>
                <p className="text-xs text-slate-400">All features. Forever.</p>
              </div>
            </div>
            <div className="mb-3">
              <span className="text-2xl font-bold text-white">₹20,000</span>
              <span className="text-slate-400 text-sm ml-1">one-time</span>
              <span className="text-slate-500 text-xs block">
                + ₹10,000/year maintenance
              </span>
            </div>
            <ul className="space-y-1 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <Check className="h-3 w-3 text-emerald-400 mt-0.5" />
                All CRM features included
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-3 w-3 text-emerald-400 mt-0.5" />
                WhatsApp Inbox, Contacts, Pipelines
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-3 w-3 text-emerald-400 mt-0.5" />
                Automations, Broadcasts, Flows
              </li>
            </ul>
          </div>

          <Button
            onClick={handleBuy}
            disabled={purchasing}
            className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-semibold"
          >
            {purchasing
              ? "Opening Razorpay..."
              : "Pay ₹20,000 — Unlock"}
          </Button>

          <p className="text-slate-600 text-xs text-center mt-2">
            🔒 Razorpay Secure Checkout
          </p>
        </div>
      </div>
    </div>
  );
}