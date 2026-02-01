-- Migration: Add Retell sync tracking columns
-- Allows tracking when prompts were last synced to Retell

-- Add retell_synced_at to track last successful sync
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS retell_synced_at timestamptz;

COMMENT ON COLUMN ai_config.retell_synced_at IS 'Timestamp of last successful Retell agent sync';

-- Add missing columns to system_logs if they don't exist
DO $$
BEGIN
  -- Add event_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_logs' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE system_logs ADD COLUMN event_type TEXT;
  END IF;

  -- Add message column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_logs' AND column_name = 'message'
  ) THEN
    ALTER TABLE system_logs ADD COLUMN message TEXT;
  END IF;

  -- Add metadata column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_logs' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE system_logs ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- Index for querying logs by business (if column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_logs' AND column_name = 'business_id') THEN
    CREATE INDEX IF NOT EXISTS idx_system_logs_business_id ON system_logs(business_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_logs' AND column_name = 'event_type') THEN
    CREATE INDEX IF NOT EXISTS idx_system_logs_event_type ON system_logs(event_type);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_logs' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
  END IF;
END $$;
