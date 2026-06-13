-- ============================================================
-- 022_subscription_plans.sql — Subscription Plan & Trial
--
-- Single plan system:
--   - Every new account gets 7-day free trial
--   - One yearly plan: ₹20,000 one-time + ₹10,000/year
--   - After trial, features locked until plan purchased
--   - Razorpay payment integration via razorpay_order_id
--   - Annual ₹10,000 fee for maintenance, development, support
--     - If not paid: customization & update features lock
--     - Base features remain active forever
-- ============================================================

-- ============================================================
-- SUBSCRIPTION_PLANS — only ONE active plan
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL DEFAULT 'Yearly Plan',
  slug TEXT NOT NULL UNIQUE DEFAULT 'yearly',
  description TEXT,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 20000.00,
  annual_fee NUMERIC(10,2) NOT NULL DEFAULT 10000.00,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscription_plans_select ON subscription_plans;
CREATE POLICY subscription_plans_select ON subscription_plans FOR SELECT USING (true);

-- Seed the single plan
INSERT INTO subscription_plans (name, slug, description, base_price, annual_fee, features) VALUES
(
  'Yearly Plan',
  'yearly',
  'Full CRM access with all features. ₹20,000 one-time setup + ₹10,000/year for maintenance, development & support.',
  1.00,
  1.00,
  '[
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
    "Software Updates"
  ]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- TRIAL TRACKING ON ACCOUNTS
-- ============================================================
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS trial_ended_at TIMESTAMPTZ;

UPDATE accounts SET trial_started_at = created_at WHERE trial_started_at IS NULL;

-- ============================================================
-- ACCOUNT_SUBSCRIPTIONS (with Razorpay fields)
-- ============================================================
CREATE TABLE IF NOT EXISTS account_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled', 'past_due')),
  base_price_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  annual_fee_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  annual_fee_due_date TIMESTAMPTZ,
  annual_fee_paid_until TIMESTAMPTZ,
  -- Razorpay payment tracking
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id)
);

CREATE INDEX IF NOT EXISTS idx_account_subscriptions_account
  ON account_subscriptions(account_id);
CREATE INDEX IF NOT EXISTS idx_account_subscriptions_status
  ON account_subscriptions(status);

ALTER TABLE account_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_subscriptions_select ON account_subscriptions;
DROP POLICY IF EXISTS account_subscriptions_modify ON account_subscriptions;

CREATE POLICY account_subscriptions_select ON account_subscriptions FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY account_subscriptions_modify ON account_subscriptions FOR ALL
  USING (is_account_member(account_id, 'admin'))
  WITH CHECK (is_account_member(account_id, 'admin'));

-- ============================================================
-- SUBSCRIPTION_PAYMENT_LOGS (Razorpay payments audit)
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_payment_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES account_subscriptions(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('base', 'annual', 'manual')),
  payment_method TEXT DEFAULT 'razorpay',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  notes TEXT,
  paid_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_logs_account ON subscription_payment_logs(account_id);

ALTER TABLE subscription_payment_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_logs_select ON subscription_payment_logs;
CREATE POLICY payment_logs_select ON subscription_payment_logs FOR SELECT
  USING (is_account_member(account_id, 'admin'));

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Check if account is in trial
CREATE OR REPLACE FUNCTION is_in_trial(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.id = p_account_id
      AND a.trial_started_at IS NOT NULL
      AND a.trial_started_at + INTERVAL '7 days' > NOW()
      AND NOT EXISTS (
        SELECT 1 FROM account_subscriptions sub
        WHERE sub.account_id = a.id
          AND sub.status = 'active'
      )
  );
$$;

ALTER FUNCTION is_in_trial(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION is_in_trial(UUID) TO authenticated, service_role;

-- Get remaining trial days
CREATE OR REPLACE FUNCTION get_trial_days_remaining(p_account_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(0, EXTRACT(DAY FROM (a.trial_started_at + INTERVAL '7 days' - NOW()))::INTEGER)
  FROM accounts a
  WHERE a.id = p_account_id
    AND a.trial_started_at IS NOT NULL;
$$;

ALTER FUNCTION get_trial_days_remaining(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION get_trial_days_remaining(UUID) TO authenticated, service_role;

-- Check if account has feature access (trial OR active sub)
CREATE OR REPLACE FUNCTION has_feature_access(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM account_subscriptions sub
      WHERE sub.account_id = p_account_id
        AND sub.status = 'active'
    )
    OR
    EXISTS (
      SELECT 1 FROM accounts a
      WHERE a.id = p_account_id
        AND a.trial_started_at IS NOT NULL
        AND a.trial_started_at + INTERVAL '7 days' > NOW()
        AND NOT EXISTS (
          SELECT 1 FROM account_subscriptions sub2
          WHERE sub2.account_id = a.id AND sub2.status = 'active'
        )
    );
$$;

ALTER FUNCTION has_feature_access(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION has_feature_access(UUID) TO authenticated, service_role;

-- Check if annual support (customization/updates) is active
CREATE OR REPLACE FUNCTION has_annual_support_access(p_account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM account_subscriptions sub
    WHERE sub.account_id = p_account_id
      AND sub.status = 'active'
      AND sub.annual_fee_paid_until IS NOT NULL
      AND sub.annual_fee_paid_until > NOW()
  );
$$;

ALTER FUNCTION has_annual_support_access(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION has_annual_support_access(UUID) TO authenticated, service_role;

-- ============================================================
-- TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS set_updated_at ON subscription_plans;
DROP TRIGGER IF EXISTS set_updated_at ON account_subscriptions;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON account_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();