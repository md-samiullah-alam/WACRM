-- ============================================================
-- 021_auto_set_account_id.sql — Auto-populate account_id on INSERT
--
-- Problem: Migration 017 made `account_id` NOT NULL on every
-- tenant table and rewrote RLS policies to use `is_account_member
-- (account_id, ...)`. But client-side code (contact-form, import-
-- modal, tags, etc.) still inserts rows with only `user_id` —
-- the client doesn't know `account_id`.
--
-- Solution: A BEFORE INSERT trigger on every table that has both
-- `user_id` and `account_id`. The trigger function reads the
-- caller's `profiles.account_id` and stamps it automatically.
-- This covers:
--   - All current client-side INSERTs
--   - Any future INSERTs
--   - Inserts from the import modal
--   - Inserts from the automation engine (service_role bypass RLS
--     but still need account_id for SELECTs/consistency)
--
-- Why not fix the client code instead?
--   - Would need changes in contact-form, import-modal, tags
--     management, settings pages, pipelines, deals, broadcasts,
--     automations, flows — ~15+ components.
--   - Every future insert path would need the same boilerplate.
--   - A DB trigger is zero-cost (one index lookup) and foolproof.
--
-- Idempotent — drops and recreates the trigger function and all
-- table triggers on each run.
-- ============================================================

-- ============================================================
-- TRIGGER FUNCTION
--
-- Reads `NEW.user_id`, looks up `profiles.account_id`, and stamps
-- it into `NEW.account_id`. If the caller is service_role (no
-- auth.uid()), or the profile row is missing, it skips — this
-- lets service_role code set account_id explicitly when needed
-- (e.g., webhook handler creating conversations/messages).
-- ============================================================

CREATE OR REPLACE FUNCTION auto_set_account_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only auto-populate if account_id is not already provided
  -- (lets callers set it explicitly when they know it).
  IF NEW.account_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT p.account_id INTO NEW.account_id
    FROM profiles p
    WHERE p.user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION auto_set_account_id() OWNER TO postgres;

-- ============================================================
-- APPLY TO EVERY TABLE WITH (user_id + account_id)
-- ============================================================

-- Parent tables (own user_id)
DROP TRIGGER IF EXISTS trg_auto_account_id_contacts ON contacts;
CREATE TRIGGER trg_auto_account_id_contacts
  BEFORE INSERT ON contacts
  FOR EACH ROW EXECUTE FUNCTION auto_set_account_id();

DROP TRIGGER IF EXISTS trg_auto_account_id_tags ON tags;
CREATE TRIGGER trg_auto_account_id_tags
  BEFORE INSERT ON tags
  FOR EACH ROW EXECUTE FUNCTION auto_set_account_id();

DROP TRIGGER IF EXISTS trg_auto_account_id_custom_fields ON custom_fields;
CREATE TRIGGER trg_auto_account_id_custom_fields
  BEFORE INSERT ON custom_fields
  FOR EACH ROW EXECUTE FUNCTION auto_set_account_id();

DROP TRIGGER IF EXISTS trg_auto_account_id_contact_notes ON contact_notes;
CREATE TRIGGER trg_auto_account_id_contact_notes
  BEFORE INSERT ON contact_notes
  FOR EACH ROW EXECUTE FUNCTION auto_set_account_id();

DROP TRIGGER IF EXISTS trg_auto_account_id_conversations ON conversations;
CREATE TRIGGER trg_auto_account_id_conversations
  BEFORE INSERT ON conversations
  FOR EACH ROW EXECUTE FUNCTION auto_set_account_id();

DROP TRIGGER IF EXISTS trg_auto_account_id_whatsapp_config ON whatsapp_config;
CREATE TRIGGER trg_auto_account_id_whatsapp_config
  BEFORE INSERT ON whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION auto_set_account_id();

DROP TRIGGER IF EXISTS trg_auto_account_id_message_templates ON message_templates;
CREATE TRIGGER trg_auto_account_id_message_templates
  BEFORE INSERT ON message_templates
  FOR EACH ROW EXECUTE FUNCTION auto_set_account_id();

DROP TRIGGER IF EXISTS trg_auto_account_id_pipelines ON pipelines;
CREATE TRIGGER trg_auto_account_id_pipelines
  BEFORE INSERT ON pipelines
  FOR EACH ROW EXECUTE FUNCTION auto_set_account_id();

DROP TRIGGER IF EXISTS trg_auto_account_id_deals ON deals;
CREATE TRIGGER trg_auto_account_id_deals
  BEFORE INSERT ON deals
  FOR EACH ROW EXECUTE FUNCTION auto_set_account_id();

DROP TRIGGER IF EXISTS trg_auto_account_id_broadcasts ON broadcasts;
CREATE TRIGGER trg_auto_account_id_broadcasts
  BEFORE INSERT ON broadcasts
  FOR EACH ROW EXECUTE FUNCTION auto_set_account_id();

DROP TRIGGER IF EXISTS trg_auto_account_id_automations ON automations;
CREATE TRIGGER trg_auto_account_id_automations
  BEFORE INSERT ON automations
  FOR EACH ROW EXECUTE FUNCTION auto_set_account_id();

DROP TRIGGER IF EXISTS trg_auto_account_id_automation_logs ON automation_logs;
CREATE TRIGGER trg_auto_account_id_automation_logs
  BEFORE INSERT ON automation_logs
  FOR EACH ROW EXECUTE FUNCTION auto_set_account_id();

DROP TRIGGER IF EXISTS trg_auto_account_id_automation_pending_executions ON automation_pending_executions;
CREATE TRIGGER trg_auto_account_id_automation_pending_executions
  BEFORE INSERT ON automation_pending_executions
  FOR EACH ROW EXECUTE FUNCTION auto_set_account_id();

DROP TRIGGER IF EXISTS trg_auto_account_id_flows ON flows;
CREATE TRIGGER trg_auto_account_id_flows
  BEFORE INSERT ON flows
  FOR EACH ROW EXECUTE FUNCTION auto_set_account_id();

DROP TRIGGER IF EXISTS trg_auto_account_id_flow_runs ON flow_runs;
CREATE TRIGGER trg_auto_account_id_flow_runs
  BEFORE INSERT ON flow_runs
  FOR EACH ROW EXECUTE FUNCTION auto_set_account_id();