-- Migration: Add voice control settings for Retell AI
-- Features: Voice temperature, voice speed, begin message delay
-- These settings give users fine-grained control over how the AI voice sounds

-- ============================================================================
-- ai_config table additions
-- ============================================================================

-- Voice Temperature: Controls voice stability vs expressiveness (0-2)
-- Lower = more stable/consistent, Higher = more expressive/varied
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS voice_temperature numeric(3,2) DEFAULT 1.0;

-- Voice Speed: Controls speech rate (0.5-2)
-- Lower = slower speech, Higher = faster speech
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS voice_speed numeric(3,2) DEFAULT 1.0;

-- Volume: Output loudness (0-2)
-- Lower = quieter, Higher = louder
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS voice_volume numeric(3,2) DEFAULT 1.0;

-- Begin Message Delay: Delay before first message in ms (0-5000)
-- Useful to let the phone ring/connect before AI speaks
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS begin_message_delay_ms integer DEFAULT 0;

-- ============================================================================
-- Constraints
-- ============================================================================

-- Validate voice temperature is between 0 and 2
ALTER TABLE ai_config DROP CONSTRAINT IF EXISTS valid_voice_temperature;
ALTER TABLE ai_config ADD CONSTRAINT valid_voice_temperature
CHECK (voice_temperature >= 0 AND voice_temperature <= 2);

-- Validate voice speed is between 0.5 and 2
ALTER TABLE ai_config DROP CONSTRAINT IF EXISTS valid_voice_speed;
ALTER TABLE ai_config ADD CONSTRAINT valid_voice_speed
CHECK (voice_speed >= 0.5 AND voice_speed <= 2);

-- Validate volume is between 0 and 2
ALTER TABLE ai_config DROP CONSTRAINT IF EXISTS valid_voice_volume;
ALTER TABLE ai_config ADD CONSTRAINT valid_voice_volume
CHECK (voice_volume >= 0 AND voice_volume <= 2);

-- Validate begin message delay is between 0 and 5000ms
ALTER TABLE ai_config DROP CONSTRAINT IF EXISTS valid_begin_message_delay;
ALTER TABLE ai_config ADD CONSTRAINT valid_begin_message_delay
CHECK (begin_message_delay_ms >= 0 AND begin_message_delay_ms <= 5000);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON COLUMN ai_config.voice_temperature IS 'Voice stability vs expressiveness (0-2). Lower = more consistent, Higher = more varied/emotional. Default 1.0.';
COMMENT ON COLUMN ai_config.voice_speed IS 'Speech rate multiplier (0.5-2). Lower = slower, Higher = faster. Default 1.0.';
COMMENT ON COLUMN ai_config.voice_volume IS 'Output volume level (0-2). Lower = quieter, Higher = louder. Default 1.0.';
COMMENT ON COLUMN ai_config.begin_message_delay_ms IS 'Delay before AI speaks after call connects (0-5000ms). Useful for natural call start. Default 0.';
