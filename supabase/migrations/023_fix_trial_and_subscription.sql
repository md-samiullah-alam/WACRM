-- ============================================================
-- 023_fix_trial_and_subscription.sql
--
-- Changes:
--   1. Change trial from 7 days to 5 minutes
--   2. Remove UNIQUE(account_id) constraint on account_subscriptions
--      so expired subscriptions don't block new purchases
--   3. Update helper functions to reflect 5-minute trial
-- ============================================================

-- 1. Remove UNIQUE constraint on account_id so expired subs don't block new ones
ALTER TABLE account_subscriptions DROP CONSTRAINT IF EXISTS account_subscriptions_account_id_key;

-- 2. Update all helper functions for 5-minute trial

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
