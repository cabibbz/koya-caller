-- Migration: Usage Audit Log Table
--
-- Creates an audit log for all usage-related changes to enable:
-- - Billing reconciliation
-- - Usage dispute resolution
-- - Debugging usage tracking issues
-- - Compliance and reporting

-- =============================================================================
-- Create usage_audit_log table
-- =============================================================================

CREATE TABLE IF NOT EXISTS usage_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  call_id uuid REFERENCES calls(id) ON DELETE SET NULL,

  -- Event type classification
  event_type text NOT NULL CHECK (event_type IN (
    'minutes_increment',    -- Normal usage increment from call
    'minutes_reset',        -- Billing cycle reset
    'overage_charged',      -- Overage minutes billed
    'manual_adjustment',    -- Admin manual adjustment
    'reconciliation'        -- Automated reconciliation fix
  )),

  -- Minutes tracking
  minutes_before integer NOT NULL,
  minutes_after integer NOT NULL,
  minutes_delta integer NOT NULL,

  -- Cost tracking (for overage)
  cost_cents integer DEFAULT 0,
  is_overage boolean DEFAULT false,

  -- Source tracking
  source text NOT NULL CHECK (source IN (
    'webhook',          -- From Retell webhook
    'retry',            -- From webhook retry job
    'admin',            -- From admin action
    'reconciliation',   -- From reconciliation job
    'stripe'            -- From Stripe webhook
  )),
  source_reference text,  -- Call ID, job ID, admin email, etc.
  notes text,             -- Additional context

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  created_by uuid        -- User ID if admin action
);

-- =============================================================================
-- Indexes for common queries
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_usage_audit_business
  ON usage_audit_log(business_id);

CREATE INDEX IF NOT EXISTS idx_usage_audit_created
  ON usage_audit_log(created_at);

CREATE INDEX IF NOT EXISTS idx_usage_audit_call
  ON usage_audit_log(call_id)
  WHERE call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_audit_event_type
  ON usage_audit_log(event_type);

CREATE INDEX IF NOT EXISTS idx_usage_audit_business_created
  ON usage_audit_log(business_id, created_at DESC);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE usage_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own business's usage audit log
CREATE POLICY "Users view own usage audit" ON usage_audit_log
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Service role has full access (for background jobs)
CREATE POLICY "Service role full access" ON usage_audit_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- Admins have full access
CREATE POLICY "Admins full access" ON usage_audit_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_app_meta_data->>'is_admin' = 'true'
    )
  );

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE usage_audit_log IS
  'Audit log for all usage-related changes including minutes increments, resets, and adjustments';

COMMENT ON COLUMN usage_audit_log.event_type IS
  'Type of usage event: minutes_increment, minutes_reset, overage_charged, manual_adjustment, reconciliation';

COMMENT ON COLUMN usage_audit_log.source IS
  'Source of the change: webhook, retry, admin, reconciliation, stripe';

COMMENT ON COLUMN usage_audit_log.source_reference IS
  'Reference ID for the source (call_id, job_id, admin email, etc.)';
