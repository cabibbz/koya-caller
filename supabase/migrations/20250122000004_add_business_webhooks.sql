-- =============================================================================
-- Business Webhooks Table
-- Stores webhook configurations for post-event notifications
-- =============================================================================

-- Create the webhooks table
CREATE TABLE IF NOT EXISTS business_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT, -- Optional signing secret for verification
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique webhook names per business
  UNIQUE(business_id, name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_business_webhooks_business_id ON business_webhooks(business_id);
CREATE INDEX IF NOT EXISTS idx_business_webhooks_active ON business_webhooks(business_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE business_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own business webhooks"
  ON business_webhooks FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own business webhooks"
  ON business_webhooks FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own business webhooks"
  ON business_webhooks FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own business webhooks"
  ON business_webhooks FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Webhook delivery log for debugging/retry
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES business_webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  response_body TEXT,
  success BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for recent deliveries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);

-- Cleanup old delivery logs (keep 30 days)
-- This would typically be run via a cron job
