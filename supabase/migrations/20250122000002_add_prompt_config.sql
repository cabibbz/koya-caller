-- Migration: Add prompt_config column to ai_config
-- This ensures the prompt_config column exists for enhanced AI settings

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

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
