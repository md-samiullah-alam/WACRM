-- ============================================================
-- 023_subscription_fix_trial.sql
-- Fixes: 5-minute trial (not 7-day), adds default trial start
-- for new accounts, removes old 7-day SQL functions
-- ============================================================

-- Drop old 7-day functions (they incorrectly enforce 7-day trial)
DROP FUNCTION IF EXISTS is_in_trial(UUID);
DROP FUNCTION IF EXISTS get_trial_days_remaining(UUID);
DROP FUNCTION IF EXISTS has_feature_access(UUID);
DROP FUNCTION IF EXISTS has_annual_support_access(UUID);

-- Re-create helpers with 5-MINUTE trial

-- Check if account is in trial (5 minutes)
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
      AND a.trial_started_at + INTERVAL '5 minutes' > NOW()
      AND NOT EXISTS (
        SELECT 1 FROM account_subscriptions sub
        WHERE sub.account_id = a.id
          AND sub.status = 'active'
      )
  );
$$;

ALTER FUNCTION is_in_trial(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION is_in_trial(UUID) TO authenticated, service_role;

-- Get remaining trial seconds
CREATE OR REPLACE FUNCTION get_trial_seconds_remaining(p_account_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(0, EXTRACT(EPOCH FROM (a.trial_started_at + INTERVAL '5 minutes' - NOW()))::INTEGER)
  FROM accounts a
  WHERE a.id = p_account_id
    AND a.trial_started_at IS NOT NULL;
$$;

ALTER FUNCTION get_trial_seconds_remaining(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION get_trial_seconds_remaining(UUID) TO authenticated, service_role;

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
        AND a.trial_started_at + INTERVAL '5 minutes' > NOW()
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

-- Ensure existing accounts that were missing trial_started_at get one set
-- (but only if they don't already have an active subscription)
UPDATE accounts
SET trial_started_at = COALESCE(trial_started_at, NOW())
WHERE trial_started_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM account_subscriptions sub
    WHERE sub.account_id = accounts.id AND sub.status = 'active'
  );