import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubscriptionPlan, AccountSubscription } from "@/types";

/**
 * ============================================================
 * Subscription Service
 *
 * All subscription database operations in one place.
 * Uses Supabase's typed client — types are inferred from the
 * generated database schema.
 * ============================================================
 */

// Hardcoded defaults used when the DB migration hasn't been applied yet.
// These match the seed data in supabase/migrations/022_subscription_plans.sql.
const DEFAULT_PLAN: SubscriptionPlan = {
  id: "default-plan",
  name: "Yearly Plan",
  slug: "yearly",
  description: "Full CRM access with all features.",
  base_price: 20000,
  annual_fee: 10000,
  features: [
    "WhatsApp Shared Inbox",
    "Contact Management",
    "Sales Pipelines & Deals",
    "Broadcast Messaging",
    "No-Code Automations",
    "Flow Builder",
    "Message Templates",
    "Custom Fields & Tags",
    "Account Sharing (Multi-User)",
    "Email Support",
    "Customization & New Development",
    "Software Updates",
  ],
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Get the active plan. Falls back to hardcoded defaults if the DB table
 * or migration has not been applied yet.
 */
export async function getActivePlan(
  supabase: SupabaseClient,
  slug = "yearly"
): Promise<SubscriptionPlan | null> {
  try {
    const { data } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (data) return data;
  } catch {
    // Table doesn't exist yet — migration not applied
  }
  return { ...DEFAULT_PLAN };
}

/**
 * Get the latest subscription for an account, ordered by created_at DESC.
 * Used by the state endpoint to provide full subscription context.
 *
 * IMPORTANT: Uses .order("created_at", { ascending: false }).limit(1)
 * because the UNIQUE(account_id) constraint was replaced with a partial
 * unique index on (account_id) WHERE status = 'active'. There may be
 * multiple rows per account (e.g., expired + active).
 */
export async function getAccountSubscription(
  supabase: SupabaseClient,
  accountId: string
): Promise<AccountSubscription | null> {
  try {
    const { data } = await supabase
      .from("account_subscriptions")
      .select("*, plan:plan_id(*)")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  } catch {
    // Table doesn't exist yet — migration not applied
  }
  return null;
}

/**
 * Get the currently ACTIVE subscription only.
 * Uses the partial unique index for fast lookup.
 */
export async function getActiveSubscription(
  supabase: SupabaseClient,
  accountId: string
): Promise<AccountSubscription | null> {
  try {
    const { data } = await supabase
      .from("account_subscriptions")
      .select("*, plan:plan_id(*)")
      .eq("account_id", accountId)
      .eq("status", "active")
      // The partial unique index ensures at most one row —
      // maybeSingle() is safe here.
      .maybeSingle();
    if (data) return data;
  } catch {
    // Table doesn't exist yet
  }
  return null;
}

/**
 * Check if any subscription row exists for an account, regardless of status.
 * Used by activateSubscription to decide whether to INSERT or UPDATE.
 *
 * IMPORTANT: Uses .limit(1) to avoid "multiple rows" errors now that
 * the UNIQUE(account_id) constraint has been removed.
 */
export async function getAnyAccountSubscription(
  supabase: SupabaseClient,
  accountId: string
): Promise<AccountSubscription | null> {
  try {
    const { data } = await supabase
      .from("account_subscriptions")
      .select("*, plan:plan_id(*)")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  } catch {
    // Table doesn't exist yet
  }
  return null;
}