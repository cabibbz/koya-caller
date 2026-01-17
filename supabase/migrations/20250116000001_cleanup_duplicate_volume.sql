-- Migration: Cleanup duplicate volume column
-- Fixes: ai_config had both 'volume' and 'voice_volume' columns
-- The correct column is 'voice_volume', so we drop the duplicate 'volume'

-- Drop duplicate volume column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_config' AND column_name = 'volume'
  ) THEN
    ALTER TABLE ai_config DROP COLUMN volume;
    RAISE NOTICE 'Dropped duplicate volume column from ai_config';
  END IF;
END $$;

-- Ensure voice_volume exists with correct definition
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS voice_volume numeric(3,2) DEFAULT 1.0;

-- Ensure constraint exists
ALTER TABLE ai_config DROP CONSTRAINT IF EXISTS valid_voice_volume;
ALTER TABLE ai_config ADD CONSTRAINT valid_voice_volume
CHECK (voice_volume >= 0 AND voice_volume <= 2);

COMMENT ON COLUMN ai_config.voice_volume IS 'Output volume level (0-2). Lower = quieter, Higher = louder. Default 1.0.';
