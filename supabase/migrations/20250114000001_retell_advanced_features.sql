-- Migration: Add Retell AI advanced features
-- Features: Voicemail Detection, Silence Handling, DTMF, Denoising, Boosted Keywords,
--           Custom Summary Prompt, PII Redaction, Fallback Voices

-- ============================================================================
-- call_settings table additions
-- ============================================================================

-- Voicemail Detection
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS voicemail_detection_enabled boolean DEFAULT false;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS voicemail_message text;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS voicemail_detection_timeout_ms integer DEFAULT 30000;

-- Silence Handling
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS reminder_trigger_ms integer DEFAULT 10000;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS reminder_max_count integer DEFAULT 2;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS end_call_after_silence_ms integer DEFAULT 30000;

-- DTMF Input (Touch-Tone)
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS dtmf_enabled boolean DEFAULT false;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS dtmf_digit_limit integer DEFAULT 10;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS dtmf_termination_key text DEFAULT '#';

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS dtmf_timeout_ms integer DEFAULT 5000;

-- Background Denoising
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS denoising_mode text DEFAULT 'noise-cancellation';

-- PII Redaction
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS pii_redaction_enabled boolean DEFAULT false;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS pii_categories text[] DEFAULT ARRAY['ssn', 'credit_card']::text[];

-- ============================================================================
-- ai_config table additions
-- ============================================================================

-- Boosted Keywords
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS boosted_keywords text[] DEFAULT '{}'::text[];

-- Custom Summary Prompt
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS analysis_summary_prompt text;

ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS analysis_model text DEFAULT 'gpt-4.1-mini';

-- Fallback Voices
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS fallback_voice_ids text[] DEFAULT '{}'::text[];

-- ============================================================================
-- Constraints
-- ============================================================================

-- Validate denoising mode
ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_denoising_mode;
ALTER TABLE call_settings ADD CONSTRAINT valid_denoising_mode
CHECK (denoising_mode IN ('noise-cancellation', 'noise-and-background-speech-cancellation'));

-- Validate DTMF termination key
ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_dtmf_termination_key;
ALTER TABLE call_settings ADD CONSTRAINT valid_dtmf_termination_key
CHECK (dtmf_termination_key IN ('#', '*', 'none'));

-- Validate analysis model
ALTER TABLE ai_config DROP CONSTRAINT IF EXISTS valid_analysis_model;
ALTER TABLE ai_config ADD CONSTRAINT valid_analysis_model
CHECK (analysis_model IN ('gpt-4.1-mini', 'claude-4.5-sonnet', 'gemini-2.5-flash'));

-- Validate timeouts are reasonable
ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_voicemail_timeout;
ALTER TABLE call_settings ADD CONSTRAINT valid_voicemail_timeout
CHECK (voicemail_detection_timeout_ms >= 5000 AND voicemail_detection_timeout_ms <= 180000);

ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_reminder_trigger;
ALTER TABLE call_settings ADD CONSTRAINT valid_reminder_trigger
CHECK (reminder_trigger_ms >= 5000 AND reminder_trigger_ms <= 60000);

ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_end_call_silence;
ALTER TABLE call_settings ADD CONSTRAINT valid_end_call_silence
CHECK (end_call_after_silence_ms >= 10000 AND end_call_after_silence_ms <= 120000);

ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_dtmf_timeout;
ALTER TABLE call_settings ADD CONSTRAINT valid_dtmf_timeout
CHECK (dtmf_timeout_ms >= 1000 AND dtmf_timeout_ms <= 15000);

ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_dtmf_digit_limit;
ALTER TABLE call_settings ADD CONSTRAINT valid_dtmf_digit_limit
CHECK (dtmf_digit_limit >= 1 AND dtmf_digit_limit <= 50);

ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_reminder_max_count;
ALTER TABLE call_settings ADD CONSTRAINT valid_reminder_max_count
CHECK (reminder_max_count >= 0 AND reminder_max_count <= 10);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON COLUMN call_settings.voicemail_detection_enabled IS 'Enable automatic voicemail detection';
COMMENT ON COLUMN call_settings.voicemail_message IS 'Message to leave when voicemail is detected';
COMMENT ON COLUMN call_settings.voicemail_detection_timeout_ms IS 'Time to wait for voicemail detection (5000-180000ms)';

COMMENT ON COLUMN call_settings.reminder_trigger_ms IS 'Milliseconds of silence before prompting caller (5000-60000)';
COMMENT ON COLUMN call_settings.reminder_max_count IS 'Maximum number of silence reminders (0-10)';
COMMENT ON COLUMN call_settings.end_call_after_silence_ms IS 'End call after this much total silence (10000-120000ms)';

COMMENT ON COLUMN call_settings.dtmf_enabled IS 'Allow callers to enter touch-tone digits';
COMMENT ON COLUMN call_settings.dtmf_digit_limit IS 'Maximum digits caller can enter (1-50)';
COMMENT ON COLUMN call_settings.dtmf_termination_key IS 'Key to end digit entry (#, *, or none)';
COMMENT ON COLUMN call_settings.dtmf_timeout_ms IS 'Time to wait for digit input (1000-15000ms)';

COMMENT ON COLUMN call_settings.denoising_mode IS 'Background noise reduction level';
COMMENT ON COLUMN call_settings.pii_redaction_enabled IS 'Enable PII redaction in transcripts';
COMMENT ON COLUMN call_settings.pii_categories IS 'PII categories to redact (ssn, credit_card, phone_number, email, date_of_birth, address)';

COMMENT ON COLUMN ai_config.boosted_keywords IS 'Words to prioritize in speech recognition';
COMMENT ON COLUMN ai_config.analysis_summary_prompt IS 'Custom prompt for generating call summaries';
COMMENT ON COLUMN ai_config.analysis_model IS 'AI model for post-call analysis';
COMMENT ON COLUMN ai_config.fallback_voice_ids IS 'Backup voice IDs if primary voice is unavailable';
