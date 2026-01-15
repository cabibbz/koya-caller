-- =============================================================================
-- Enhanced Prompt System Migration
-- Adds support for:
-- 1. Prompt configuration (industry enhancements, sentiment detection, etc.)
-- 2. Caller profiles for repeat caller recognition
-- 3. Sentiment tracking on calls
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add prompt_config column to ai_config table
-- -----------------------------------------------------------------------------

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

-- Add comment
COMMENT ON COLUMN ai_config.prompt_config IS 'Enhanced prompt system configuration for industry-specific prompts, sentiment detection, and caller context';

-- -----------------------------------------------------------------------------
-- 2. Create caller_profiles table for repeat caller recognition
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS caller_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  name TEXT,
  email TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  call_count INT DEFAULT 1,
  last_call_at TIMESTAMPTZ DEFAULT now(),
  last_outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure unique phone per business
  CONSTRAINT unique_business_caller UNIQUE (business_id, phone_number)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_caller_profiles_lookup
  ON caller_profiles(business_id, phone_number);

CREATE INDEX IF NOT EXISTS idx_caller_profiles_business
  ON caller_profiles(business_id);

-- Add RLS policies
ALTER TABLE caller_profiles ENABLE ROW LEVEL SECURITY;

-- Business owners can read their caller profiles
CREATE POLICY "Business owners can read caller profiles"
  ON caller_profiles
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Business owners can insert caller profiles
CREATE POLICY "Business owners can insert caller profiles"
  ON caller_profiles
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Business owners can update caller profiles
CREATE POLICY "Business owners can update caller profiles"
  ON caller_profiles
  FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything (for API calls)
CREATE POLICY "Service role full access to caller profiles"
  ON caller_profiles
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add comment
COMMENT ON TABLE caller_profiles IS 'Stores caller information for repeat caller recognition and personalization';

-- -----------------------------------------------------------------------------
-- 3. Add sentiment tracking to calls table
-- -----------------------------------------------------------------------------

ALTER TABLE calls
ADD COLUMN IF NOT EXISTS sentiment_detected TEXT;

ALTER TABLE calls
ADD COLUMN IF NOT EXISTS error_recovery_used BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON COLUMN calls.sentiment_detected IS 'Detected caller sentiment during the call (pleased, neutral, frustrated, upset, angry)';
COMMENT ON COLUMN calls.error_recovery_used IS 'Whether error recovery messages were used during the call';

-- Create index for sentiment analysis
CREATE INDEX IF NOT EXISTS idx_calls_sentiment
  ON calls(business_id, sentiment_detected)
  WHERE sentiment_detected IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Create function to increment caller call count
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION increment_caller_count(
  p_business_id UUID,
  p_phone_number TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO caller_profiles (business_id, phone_number, call_count, last_call_at)
  VALUES (p_business_id, p_phone_number, 1, now())
  ON CONFLICT (business_id, phone_number)
  DO UPDATE SET
    call_count = caller_profiles.call_count + 1,
    last_call_at = now(),
    updated_at = now();
END;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION increment_caller_count TO authenticated;
GRANT EXECUTE ON FUNCTION increment_caller_count TO service_role;

-- -----------------------------------------------------------------------------
-- 5. Create function to update caller profile after call
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_caller_profile(
  p_business_id UUID,
  p_phone_number TEXT,
  p_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_outcome TEXT DEFAULT NULL,
  p_preferences JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO caller_profiles (business_id, phone_number, name, email, last_outcome, preferences, last_call_at)
  VALUES (
    p_business_id,
    p_phone_number,
    p_name,
    p_email,
    p_outcome,
    COALESCE(p_preferences, '{}'::jsonb),
    now()
  )
  ON CONFLICT (business_id, phone_number)
  DO UPDATE SET
    name = COALESCE(NULLIF(p_name, ''), caller_profiles.name),
    email = COALESCE(NULLIF(p_email, ''), caller_profiles.email),
    last_outcome = COALESCE(p_outcome, caller_profiles.last_outcome),
    preferences = caller_profiles.preferences || COALESCE(p_preferences, '{}'::jsonb),
    call_count = caller_profiles.call_count + 1,
    last_call_at = now(),
    updated_at = now();
END;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION update_caller_profile TO authenticated;
GRANT EXECUTE ON FUNCTION update_caller_profile TO service_role;

-- -----------------------------------------------------------------------------
-- 6. Create view for caller insights
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW caller_insights AS
SELECT
  cp.business_id,
  cp.phone_number,
  cp.name,
  cp.call_count,
  cp.last_call_at,
  cp.last_outcome,
  cp.preferences,
  CASE
    WHEN cp.call_count >= 5 THEN 'vip'
    WHEN cp.call_count >= 2 THEN 'returning'
    ELSE 'new'
  END as caller_tier,
  (
    SELECT COUNT(*)
    FROM appointments a
    WHERE a.customer_phone = cp.phone_number
    AND a.business_id = cp.business_id
  ) as appointment_count,
  (
    SELECT a.service_name
    FROM appointments a
    WHERE a.customer_phone = cp.phone_number
    AND a.business_id = cp.business_id
    ORDER BY a.scheduled_at DESC
    LIMIT 1
  ) as last_service_booked
FROM caller_profiles cp;

-- Grant select on view
GRANT SELECT ON caller_insights TO authenticated;
GRANT SELECT ON caller_insights TO service_role;

-- Add comment
COMMENT ON VIEW caller_insights IS 'Provides insights about callers including tier classification and booking history';
