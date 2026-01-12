-- Migration: Add Retell sync tracking columns
-- Allows tracking when prompts were last synced to Retell

-- Add retell_synced_at to track last successful sync
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS retell_synced_at timestamptz;

COMMENT ON COLUMN ai_config.retell_synced_at IS 'Timestamp of last successful Retell agent sync';

-- Ensure system_logs table exists for error tracking
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying logs by business
CREATE INDEX IF NOT EXISTS idx_system_logs_business_id ON system_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_event_type ON system_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

-- RLS for system_logs
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own business logs
CREATE POLICY IF NOT EXISTS "Users can read own business logs"
ON system_logs FOR SELECT
USING (
  business_id IN (
    SELECT id FROM businesses WHERE user_id = auth.uid()
  )
);
