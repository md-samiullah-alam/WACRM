-- ============================================================
-- 024_consolidated_subscription_fix.sql
--
-- Consolidates fixes from the conflicting 023_* migrations and
-- adds the critical missing piece: trial_started_at on signup.
--
-- Changes:
--   1. Drop old 7-day functions (idempotent)
--   2. Create correct 5-minute trial functions
--   3. Remove UNIQUE(account_id) constraint on account_subscriptions
--      so expired subscriptions don't block new purchases
--   4. Add partial unique index for only active subscriptions
--   5. Update handle_new_user trigger to set trial_started_at
--   6. Backfill trial_started_at for existing accounts
-- ============================================================

-- ============================================================
-- 1. Drop old 7-day functions (safe — IF EXISTS handles missing)
-- ============================================================
DROP FUNCTION IF EXISTS is_in_trial(UUID);
DROP FUNCTION IF EXISTS get_trial_days_remaining(UUID);
DROP FUNCTION IF EXISTS get_trial_seconds_remaining(UUID);
DROP FUNCTION IF EXISTS has_feature_access(UUID);
DROP FUNCTION IF EXISTS has_annual_support_access(UUID);

-- ============================================================
-- 2. Remove UNIQUE(account_id) on account_subscriptions
--    so expired subs don't block new purchases.
--    Replace with a partial unique index that only enforces
--    one active subscription per account.
-- ============================================================
ALTER TABLE account_subscriptions DROP CONSTRAINT IF EXISTS account_subscriptions_account_id_key;

DROP INDEX IF EXISTS idx_active_subscription_per_account;
CREATE UNIQUE INDEX idx_active_subscription_per_account
  ON account_subscriptions(account_id)
  WHERE status = 'active';

-- ============================================================
-- 3. Create helpers with 5-MINUTE trial
-- ============================================================

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

-- ============================================================
-- 4. Backfill trial_started_at for existing accounts that
--    are missing it and don't have an active subscription.
-- ============================================================
UPDATE accounts
SET trial_started_at = COALESCE(trial_started_at, created_at)
WHERE trial_started_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM account_subscriptions sub
    WHERE sub.account_id = accounts.id AND sub.status = 'active'
  );

-- ============================================================
-- 5. CRITICAL FIX: Update handle_new_user trigger to set
--    trial_started_at on account creation.
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_account_id UUID;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.accounts (name, owner_user_id, trial_started_at)
  VALUES (
    COALESCE(NULLIF(v_full_name, ''), NEW.email, 'My account'),
    NEW.id,
    NOW()  -- <-- CRITICAL: start the 5-minute trial at account creation
  )
  RETURNING id INTO v_account_id;

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to bootstrap account/profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();