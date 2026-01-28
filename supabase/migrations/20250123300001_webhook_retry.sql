-- Migration: Incoming Webhook Retry System
-- Stores failed incoming webhooks from external services (Stripe, Retell, Twilio)
-- and enables automatic retry with exponential backoff

-- ============================================
-- Failed Webhooks Table
-- Stores incoming webhooks that failed processing
-- ============================================
CREATE TABLE IF NOT EXISTS failed_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL, -- 'stripe', 'retell', 'twilio'
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'retrying', 'success', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Validate source
  CONSTRAINT failed_webhooks_valid_source CHECK (source IN ('stripe', 'retell', 'twilio')),
  -- Validate status
  CONSTRAINT failed_webhooks_valid_status CHECK (status IN ('pending', 'retrying', 'success', 'failed'))
);

-- Indexes for efficient queries
CREATE INDEX idx_failed_webhooks_status ON failed_webhooks(status, next_retry_at);
CREATE INDEX idx_failed_webhooks_source ON failed_webhooks(source);
CREATE INDEX idx_failed_webhooks_created_at ON failed_webhooks(created_at);

-- Comments for documentation
COMMENT ON TABLE failed_webhooks IS 'Stores failed incoming webhooks for retry processing';
COMMENT ON COLUMN failed_webhooks.source IS 'Webhook source: stripe, retell, or twilio';
COMMENT ON COLUMN failed_webhooks.event_type IS 'Original event type from the webhook';
COMMENT ON COLUMN failed_webhooks.payload IS 'Original webhook payload for retry';
COMMENT ON COLUMN failed_webhooks.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN failed_webhooks.max_retries IS 'Maximum retry attempts allowed (default 5)';
COMMENT ON COLUMN failed_webhooks.next_retry_at IS 'When the next retry should be attempted';
COMMENT ON COLUMN failed_webhooks.status IS 'pending (first failure), retrying, success, or failed (exhausted retries)';

-- ============================================
-- Updated At Trigger
-- ============================================
CREATE OR REPLACE TRIGGER update_failed_webhooks_updated_at
  BEFORE UPDATE ON failed_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Helper Function: Calculate Retry Delay
-- Exponential backoff: 1min, 5min, 15min, 1hr, 4hr
-- ============================================
CREATE OR REPLACE FUNCTION calculate_failed_webhook_retry_delay(attempt_count INTEGER)
RETURNS INTERVAL
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE attempt_count
    WHEN 0 THEN interval '1 minute'
    WHEN 1 THEN interval '5 minutes'
    WHEN 2 THEN interval '15 minutes'
    WHEN 3 THEN interval '1 hour'
    WHEN 4 THEN interval '4 hours'
    ELSE interval '4 hours'
  END
$$;

COMMENT ON FUNCTION calculate_failed_webhook_retry_delay IS 'Calculates exponential backoff delay for failed webhook retries';

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE failed_webhooks ENABLE ROW LEVEL SECURITY;

-- Only service role can access failed_webhooks (background job processing)
DROP POLICY IF EXISTS "Service role only for failed_webhooks" ON failed_webhooks;
CREATE POLICY "Service role only for failed_webhooks" ON failed_webhooks
  FOR ALL USING (auth.role() = 'service_role');
