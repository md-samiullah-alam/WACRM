"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/use-auth";
import type { SubscriptionState, SubscriptionPlan } from "@/types";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

interface SubscriptionContextValue {
  state: SubscriptionState | null;
  loading: boolean;
  refresh: () => Promise<void>;
  plans: SubscriptionPlan[];
  plansLoading: boolean;
  openPaymentPage: (paymentType?: "initial" | "annual") => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { accountId } = useAuth();
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const res = await fetch("/api/subscription/plans");
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans ?? []);
      }
    } catch {
      // silent
    } finally {
      setPlansLoading(false);
    }
  }, []);

  const fetchState = useCallback(async () => {
    if (!accountId) return;
    try {
      setLoading(true);
      const res = await fetch("/api/subscription/state");
      if (res.ok) {
        const data = await res.json();
        setState(data.state ?? null);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  // Auto-refresh subscription state every 15 seconds to keep
  // the trial countdown and subscription status current
  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    if (accountId) {
      fetchState();

      // Poll for trial state changes — every 60 seconds is enough.
      // The trial banner has its own client-side countdown timer
      // that ticks every second, so frequent server re-fetches
      // are unnecessary and cause layout jitter.
      const interval = setInterval(fetchState, 60_000);
      return () => clearInterval(interval);
    } else {
      setState(null);
      setLoading(false);
    }
  }, [accountId, fetchState]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchState(), fetchPlans()]);
  }, [fetchState, fetchPlans]);

  /**
   * Open the Razorpay payment checkout.
   *
   * IMPORTANT: The API returns `amount` in Rupees (not paise).
   * Razorpay's `checkout.amount` expects paise, so we multiply by
   * 100 here. The create-order API already rounds to whole rupees.
   */
  const openPaymentPage = useCallback(async (paymentType: "initial" | "annual" = "initial") => {
    try {
      const res = await fetch("/api/subscription/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentType }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("[Razorpay] Failed to create order:", err.error);
        return;
      }

      const { orderId, amount, currency, description, plan: planInfo } = await res.json();

      // amount is in Rupees from the API — convert to paise for Razorpay
      const amountInPaise = Math.round(amount * 100);

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: amountInPaise,
        currency,
        name: planInfo?.name ?? "Yearly Plan",
        description,
        order_id: orderId,
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          const verifyRes = await fetch("/api/subscription/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });

          if (verifyRes.ok) {
            await refresh();
          }
        },
        modal: {
          ondismiss: () => {
            // Modal closed — refresh state in case payment succeeded
            refresh();
          },
        },
        prefill: {
          contact: "",
          email: "",
        },
        theme: {
          color: "#6366f1",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("[Razorpay] Checkout error:", err);
    }
  }, [refresh]);

  return (
    <SubscriptionContext.Provider
      value={{ state, loading, refresh, plans, plansLoading, openPaymentPage }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    return {
      state: null, loading: false, refresh: async () => {},
      plans: [], plansLoading: false,
      openPaymentPage: async () => {},
    };
  }
  return ctx;
}