-- Migration: Force add advanced AI columns (schema cache refresh)
-- This migration ensures all advanced columns exist

-- ============================================================================
-- call_settings table - Advanced Call Features
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

-- DTMF Input
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS dtmf_enabled boolean DEFAULT false;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS dtmf_digit_limit integer DEFAULT 10;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS dtmf_termination_key text DEFAULT '#';

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS dtmf_timeout_ms integer DEFAULT 5000;

-- Denoising
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS denoising_mode text DEFAULT 'noise-cancellation';

-- PII Redaction
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS pii_redaction_enabled boolean DEFAULT false;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS pii_categories text[] DEFAULT ARRAY['ssn', 'credit_card']::text[];

-- Responsiveness settings
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS interruption_sensitivity numeric(3,2) DEFAULT 0.9;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS responsiveness numeric(3,2) DEFAULT 0.9;

-- ============================================================================
-- ai_config table - Advanced AI Features
-- ============================================================================

-- Boosted Keywords
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS boosted_keywords text[] DEFAULT '{}'::text[];

-- Custom Summary Prompt
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS analysis_summary_prompt text;

-- Analysis Model
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS analysis_model text DEFAULT 'gpt-4.1-mini';

-- Prompt Config (JSONB for enhanced prompt system)
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS prompt_config JSONB DEFAULT '{
  "industryEnhancements": true,
  "fewShotExamplesEnabled": true,
  "sentimentDetectionLevel": "basic",
  "callerContextEnabled": true,
  "toneIntensity": 3,
  "personalityAwareErrors": true,
  "maxFewShotExamples": 3
}'::jsonb;

-- Fallback Voices
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS fallback_voice_ids text[] DEFAULT '{}'::text[];

-- ============================================================================
-- Notify PostgREST to reload schema cache
-- ============================================================================
NOTIFY pgrst, 'reload schema';
