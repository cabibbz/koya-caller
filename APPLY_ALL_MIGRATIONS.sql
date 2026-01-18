-- ============================================================================
-- KOYA CALLER - COMPLETE MIGRATIONS (January 9-16, 2025)
-- ============================================================================
-- Run this entire script in Supabase SQL Editor to apply all recent migrations
-- URL: https://supabase.com/dashboard/project/jkfcipjastgqtusijbav/sql/new
-- ============================================================================
-- INCLUDES 12 MIGRATIONS:
-- 1. Fix Calls and Settings (Jan 9)
-- 2. Enhanced Prompt System (Jan 10)
-- 3. Upsells Feature (Jan 11)
-- 4. Advanced Upselling - Bundles, Packages, Memberships (Jan 12)
-- 5. Appointment Reminder Columns (Jan 13)
-- 6. Atomic Increment and Constraints (Jan 13)
-- 7. Retell Sync Tracking (Jan 13)
-- 8. Retell Advanced Features (Jan 14)
-- 9. Responsiveness Settings (Jan 14)
-- 10. Industry Column (Jan 14)
-- 11. Voice Controls (Jan 15)
-- 12. Cleanup Duplicate Volume Column (Jan 16)
-- ============================================================================

-- ============================================================================
-- MIGRATION 1: Fix Calls and Settings (Jan 9, 2025)
-- ============================================================================

-- Add flagged column for marking important calls
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS flagged boolean DEFAULT false;

-- Add notes column for user annotations
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS notes text;

-- Add index for filtering flagged calls
CREATE INDEX IF NOT EXISTS idx_calls_flagged
ON calls(business_id, flagged)
WHERE flagged = true;

-- Add after_hours_action column
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS after_hours_action text DEFAULT 'ai';

COMMENT ON COLUMN call_settings.after_hours_action IS
'Action to take for after-hours calls: voicemail, ai, or transfer';

-- Add recording_enabled column
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS recording_enabled boolean DEFAULT true;

-- Index for fetching recent calls by business
CREATE INDEX IF NOT EXISTS idx_calls_business_started
ON calls(business_id, started_at DESC);

-- Index for filtering by outcome
CREATE INDEX IF NOT EXISTS idx_calls_business_outcome
ON calls(business_id, outcome);

-- Index for searching by phone number
CREATE INDEX IF NOT EXISTS idx_calls_from_number
ON calls(from_number);

-- Update any existing null values to defaults
UPDATE calls SET flagged = false WHERE flagged IS NULL;
UPDATE call_settings SET after_hours_action = 'ai' WHERE after_hours_action IS NULL;
UPDATE call_settings SET recording_enabled = true WHERE recording_enabled IS NULL;


-- ============================================================================
-- MIGRATION 2: Enhanced Prompt System (Jan 10, 2025)
-- ============================================================================

-- Add prompt_config column to ai_config table
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

COMMENT ON COLUMN ai_config.prompt_config IS 'Enhanced prompt system configuration';

-- Create caller_profiles table for repeat caller recognition
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
  CONSTRAINT unique_business_caller UNIQUE (business_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_caller_profiles_lookup
  ON caller_profiles(business_id, phone_number);

CREATE INDEX IF NOT EXISTS idx_caller_profiles_business
  ON caller_profiles(business_id);

-- RLS for caller_profiles
ALTER TABLE caller_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business owners can read caller profiles" ON caller_profiles;
CREATE POLICY "Business owners can read caller profiles"
  ON caller_profiles FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Business owners can insert caller profiles" ON caller_profiles;
CREATE POLICY "Business owners can insert caller profiles"
  ON caller_profiles FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Business owners can update caller profiles" ON caller_profiles;
CREATE POLICY "Business owners can update caller profiles"
  ON caller_profiles FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role full access to caller profiles" ON caller_profiles;
CREATE POLICY "Service role full access to caller profiles"
  ON caller_profiles FOR ALL
  USING (auth.role() = 'service_role');

-- Add sentiment tracking to calls table
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS sentiment_detected TEXT;

ALTER TABLE calls
ADD COLUMN IF NOT EXISTS error_recovery_used BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_calls_sentiment
  ON calls(business_id, sentiment_detected)
  WHERE sentiment_detected IS NOT NULL;

-- Function to increment caller count
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

GRANT EXECUTE ON FUNCTION increment_caller_count TO authenticated;
GRANT EXECUTE ON FUNCTION increment_caller_count TO service_role;

-- Function to update caller profile after call
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
    p_business_id, p_phone_number, p_name, p_email, p_outcome,
    COALESCE(p_preferences, '{}'::jsonb), now()
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

GRANT EXECUTE ON FUNCTION update_caller_profile TO authenticated;
GRANT EXECUTE ON FUNCTION update_caller_profile TO service_role;

-- Create view for caller insights
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
  (SELECT COUNT(*) FROM appointments a WHERE a.customer_phone = cp.phone_number AND a.business_id = cp.business_id) as appointment_count,
  (SELECT a.service_name FROM appointments a WHERE a.customer_phone = cp.phone_number AND a.business_id = cp.business_id ORDER BY a.scheduled_at DESC LIMIT 1) as last_service_booked
FROM caller_profiles cp;

GRANT SELECT ON caller_insights TO authenticated;
GRANT SELECT ON caller_insights TO service_role;


-- ============================================================================
-- MIGRATION 3: Upsells Feature (Jan 11, 2025)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Upsells table
CREATE TABLE IF NOT EXISTS upsells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source_service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  target_service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  discount_percent int DEFAULT 0,
  pitch_message text,
  trigger_timing text DEFAULT 'before_booking',
  is_active boolean DEFAULT true,
  times_offered int DEFAULT 0,
  times_accepted int DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT valid_discount CHECK (discount_percent >= 0 AND discount_percent <= 100),
  CONSTRAINT valid_timing CHECK (trigger_timing IN ('before_booking', 'after_booking')),
  CONSTRAINT different_services CHECK (source_service_id != target_service_id),
  CONSTRAINT unique_upsell_per_service_pair UNIQUE (business_id, source_service_id, target_service_id)
);

CREATE INDEX IF NOT EXISTS idx_upsells_business_id ON upsells(business_id);
CREATE INDEX IF NOT EXISTS idx_upsells_source_service ON upsells(source_service_id);
CREATE INDEX IF NOT EXISTS idx_upsells_active ON upsells(business_id, is_active) WHERE is_active = true;

-- Add upsells_enabled to ai_config
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS upsells_enabled boolean DEFAULT true;

-- RLS for upsells
ALTER TABLE upsells ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own business upsells" ON upsells;
CREATE POLICY "Users can view own business upsells"
  ON upsells FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own business upsells" ON upsells;
CREATE POLICY "Users can insert own business upsells"
  ON upsells FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own business upsells" ON upsells;
CREATE POLICY "Users can update own business upsells"
  ON upsells FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own business upsells" ON upsells;
CREATE POLICY "Users can delete own business upsells"
  ON upsells FOR DELETE
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role can access all upsells" ON upsells;
CREATE POLICY "Service role can access all upsells"
  ON upsells FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================================
-- MIGRATION 4: Advanced Upselling - Bundles, Packages, Memberships (Jan 12, 2025)
-- ============================================================================

-- Bundles Table
CREATE TABLE IF NOT EXISTS bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  discount_percent int DEFAULT 0,
  pitch_message text,
  is_active boolean DEFAULT true,
  times_offered int DEFAULT 0,
  times_accepted int DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT valid_bundle_discount CHECK (discount_percent >= 0 AND discount_percent <= 100),
  CONSTRAINT valid_bundle_times_offered CHECK (times_offered >= 0),
  CONSTRAINT valid_bundle_times_accepted CHECK (times_accepted >= 0)
);

-- Bundle Services Junction Table
CREATE TABLE IF NOT EXISTS bundle_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  sort_order int DEFAULT 0,
  CONSTRAINT unique_bundle_service UNIQUE (bundle_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_bundles_business_id ON bundles(business_id);
CREATE INDEX IF NOT EXISTS idx_bundles_active ON bundles(business_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bundle_services_bundle ON bundle_services(bundle_id);
CREATE INDEX IF NOT EXISTS idx_bundle_services_service ON bundle_services(service_id);

-- Packages Table
CREATE TABLE IF NOT EXISTS packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  session_count int NOT NULL,
  discount_percent int DEFAULT 0,
  price_cents int,
  validity_days int,
  pitch_message text,
  min_visits_to_pitch int DEFAULT 0,
  is_active boolean DEFAULT true,
  times_offered int DEFAULT 0,
  times_accepted int DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT valid_package_discount CHECK (discount_percent >= 0 AND discount_percent <= 100),
  CONSTRAINT valid_session_count CHECK (session_count >= 2),
  CONSTRAINT valid_pkg_validity_days CHECK (validity_days IS NULL OR validity_days > 0),
  CONSTRAINT valid_pkg_min_visits CHECK (min_visits_to_pitch >= 0),
  CONSTRAINT valid_package_times_offered CHECK (times_offered >= 0),
  CONSTRAINT valid_package_times_accepted CHECK (times_accepted >= 0)
);

CREATE INDEX IF NOT EXISTS idx_packages_business_id ON packages(business_id);
CREATE INDEX IF NOT EXISTS idx_packages_active ON packages(business_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_packages_service ON packages(service_id);

-- Memberships Table
CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents int NOT NULL,
  billing_period text DEFAULT 'monthly',
  benefits text NOT NULL,
  pitch_message text,
  pitch_after_booking_amount_cents int,
  pitch_after_visit_count int,
  is_active boolean DEFAULT true,
  times_offered int DEFAULT 0,
  times_accepted int DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT valid_membership_price CHECK (price_cents > 0),
  CONSTRAINT valid_billing_period CHECK (billing_period IN ('monthly', 'quarterly', 'annual')),
  CONSTRAINT valid_pitch_amount CHECK (pitch_after_booking_amount_cents IS NULL OR pitch_after_booking_amount_cents >= 0),
  CONSTRAINT valid_pitch_visits CHECK (pitch_after_visit_count IS NULL OR pitch_after_visit_count >= 0),
  CONSTRAINT valid_membership_times_offered CHECK (times_offered >= 0),
  CONSTRAINT valid_membership_times_accepted CHECK (times_accepted >= 0)
);

CREATE INDEX IF NOT EXISTS idx_memberships_business_id ON memberships(business_id);
CREATE INDEX IF NOT EXISTS idx_memberships_active ON memberships(business_id, is_active) WHERE is_active = true;

-- Extend upsells for availability-based suggestions
ALTER TABLE upsells ADD COLUMN IF NOT EXISTS suggest_when_unavailable boolean DEFAULT false;

-- Add feature toggles to ai_config
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS bundles_enabled boolean DEFAULT true;
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS packages_enabled boolean DEFAULT true;
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS memberships_enabled boolean DEFAULT true;

-- RLS for bundles
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own business bundles" ON bundles;
CREATE POLICY "Users can view own business bundles"
  ON bundles FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own business bundles" ON bundles;
CREATE POLICY "Users can insert own business bundles"
  ON bundles FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own business bundles" ON bundles;
CREATE POLICY "Users can update own business bundles"
  ON bundles FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own business bundles" ON bundles;
CREATE POLICY "Users can delete own business bundles"
  ON bundles FOR DELETE
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role can access all bundles" ON bundles;
CREATE POLICY "Service role can access all bundles"
  ON bundles FOR ALL
  USING (auth.role() = 'service_role');

-- RLS for bundle_services
ALTER TABLE bundle_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bundle services" ON bundle_services;
CREATE POLICY "Users can view own bundle services"
  ON bundle_services FOR SELECT
  USING (bundle_id IN (SELECT id FROM bundles WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Users can insert own bundle services" ON bundle_services;
CREATE POLICY "Users can insert own bundle services"
  ON bundle_services FOR INSERT
  WITH CHECK (bundle_id IN (SELECT id FROM bundles WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Users can update own bundle services" ON bundle_services;
CREATE POLICY "Users can update own bundle services"
  ON bundle_services FOR UPDATE
  USING (bundle_id IN (SELECT id FROM bundles WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Users can delete own bundle services" ON bundle_services;
CREATE POLICY "Users can delete own bundle services"
  ON bundle_services FOR DELETE
  USING (bundle_id IN (SELECT id FROM bundles WHERE business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())));

DROP POLICY IF EXISTS "Service role can access all bundle services" ON bundle_services;
CREATE POLICY "Service role can access all bundle services"
  ON bundle_services FOR ALL
  USING (auth.role() = 'service_role');

-- RLS for packages
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own business packages" ON packages;
CREATE POLICY "Users can view own business packages"
  ON packages FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own business packages" ON packages;
CREATE POLICY "Users can insert own business packages"
  ON packages FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own business packages" ON packages;
CREATE POLICY "Users can update own business packages"
  ON packages FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own business packages" ON packages;
CREATE POLICY "Users can delete own business packages"
  ON packages FOR DELETE
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role can access all packages" ON packages;
CREATE POLICY "Service role can access all packages"
  ON packages FOR ALL
  USING (auth.role() = 'service_role');

-- RLS for memberships
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own business memberships" ON memberships;
CREATE POLICY "Users can view own business memberships"
  ON memberships FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert own business memberships" ON memberships;
CREATE POLICY "Users can insert own business memberships"
  ON memberships FOR INSERT
  WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own business memberships" ON memberships;
CREATE POLICY "Users can update own business memberships"
  ON memberships FOR UPDATE
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own business memberships" ON memberships;
CREATE POLICY "Users can delete own business memberships"
  ON memberships FOR DELETE
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role can access all memberships" ON memberships;
CREATE POLICY "Service role can access all memberships"
  ON memberships FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================================
-- MIGRATION 5: Appointment Reminder Columns (Jan 13, 2025)
-- ============================================================================

ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS reminder_1hr_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS reminder_24hr_sent_at timestamptz;

-- Migrate existing reminder_sent_at data
UPDATE appointments
SET reminder_24hr_sent_at = reminder_sent_at
WHERE reminder_sent_at IS NOT NULL
  AND reminder_24hr_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_reminder_1hr
ON appointments(scheduled_at)
WHERE reminder_1hr_sent_at IS NULL AND status = 'confirmed';

CREATE INDEX IF NOT EXISTS idx_appointments_reminder_24hr
ON appointments(scheduled_at)
WHERE reminder_24hr_sent_at IS NULL AND status = 'confirmed';


-- ============================================================================
-- MIGRATION 6: Atomic Increment and Constraints (Jan 13, 2025)
-- ============================================================================

-- Atomic increment function for usage minutes
CREATE OR REPLACE FUNCTION increment_usage_minutes(
  p_business_id uuid,
  p_minutes integer
)
RETURNS TABLE (
  id uuid,
  name text,
  minutes_used_this_cycle integer,
  current_cycle_start date,
  current_cycle_end date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_minutes <= 0 THEN
    RAISE EXCEPTION 'Minutes must be a positive integer';
  END IF;
  IF p_minutes > 1440 THEN
    RAISE EXCEPTION 'Minutes increment exceeds maximum allowed value (1440)';
  END IF;

  RETURN QUERY
  UPDATE businesses
  SET minutes_used_this_cycle = COALESCE(minutes_used_this_cycle, 0) + p_minutes
  WHERE businesses.id = p_business_id
  RETURNING
    businesses.id,
    businesses.name,
    businesses.minutes_used_this_cycle,
    businesses.current_cycle_start,
    businesses.current_cycle_end;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_usage_minutes(uuid, integer) TO authenticated;

-- Package constraints
ALTER TABLE packages DROP CONSTRAINT IF EXISTS valid_package_price;
ALTER TABLE packages ADD CONSTRAINT valid_package_price CHECK (price_cents IS NULL OR price_cents >= 0);

ALTER TABLE packages DROP CONSTRAINT IF EXISTS valid_min_visits;
ALTER TABLE packages ADD CONSTRAINT valid_min_visits CHECK (min_visits_to_pitch >= 0 AND min_visits_to_pitch <= 1000);

ALTER TABLE packages DROP CONSTRAINT IF EXISTS valid_session_count_range;
ALTER TABLE packages ADD CONSTRAINT valid_session_count_range CHECK (session_count >= 2 AND session_count <= 100);

ALTER TABLE packages DROP CONSTRAINT IF EXISTS valid_validity_days;
ALTER TABLE packages ADD CONSTRAINT valid_validity_days CHECK (validity_days IS NULL OR (validity_days >= 1 AND validity_days <= 365));

-- Business constraints
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS valid_minutes_used;
ALTER TABLE businesses ADD CONSTRAINT valid_minutes_used CHECK (minutes_used_this_cycle IS NULL OR minutes_used_this_cycle >= 0);


-- ============================================================================
-- MIGRATION 7: Retell Sync Tracking (Jan 13, 2025)
-- ============================================================================

ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS retell_synced_at timestamptz;

-- Add missing columns to system_logs if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_logs' AND column_name = 'event_type') THEN
    ALTER TABLE system_logs ADD COLUMN event_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_logs' AND column_name = 'message') THEN
    ALTER TABLE system_logs ADD COLUMN message TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_logs' AND column_name = 'metadata') THEN
    ALTER TABLE system_logs ADD COLUMN metadata JSONB;
  END IF;
END $$;


-- ============================================================================
-- MIGRATION 8: Retell Advanced Features (Jan 14, 2025)
-- ============================================================================

-- Voicemail Detection
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS voicemail_detection_enabled boolean DEFAULT false;
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS voicemail_message text;
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS voicemail_detection_timeout_ms integer DEFAULT 30000;

-- Silence Handling
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS reminder_trigger_ms integer DEFAULT 10000;
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS reminder_max_count integer DEFAULT 2;
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS end_call_after_silence_ms integer DEFAULT 30000;

-- DTMF Input
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS dtmf_enabled boolean DEFAULT false;
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS dtmf_digit_limit integer DEFAULT 10;
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS dtmf_termination_key text DEFAULT '#';
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS dtmf_timeout_ms integer DEFAULT 5000;

-- Denoising
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS denoising_mode text DEFAULT 'noise-cancellation';

-- PII Redaction
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS pii_redaction_enabled boolean DEFAULT false;
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS pii_categories text[] DEFAULT ARRAY['ssn', 'credit_card']::text[];

-- AI Config additions
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS boosted_keywords text[] DEFAULT '{}'::text[];
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS analysis_summary_prompt text;
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS analysis_model text DEFAULT 'gpt-4.1-mini';
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS fallback_voice_ids text[] DEFAULT '{}'::text[];

-- Constraints for call_settings
ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_denoising_mode;
ALTER TABLE call_settings ADD CONSTRAINT valid_denoising_mode
CHECK (denoising_mode IN ('noise-cancellation', 'noise-and-background-speech-cancellation'));

ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_dtmf_termination_key;
ALTER TABLE call_settings ADD CONSTRAINT valid_dtmf_termination_key
CHECK (dtmf_termination_key IN ('#', '*', 'none'));

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

-- Constraint for ai_config analysis model
ALTER TABLE ai_config DROP CONSTRAINT IF EXISTS valid_analysis_model;
ALTER TABLE ai_config ADD CONSTRAINT valid_analysis_model
CHECK (analysis_model IN ('gpt-4.1-mini', 'claude-4.5-sonnet', 'gemini-2.5-flash'));


-- ============================================================================
-- MIGRATION 9: Add Responsiveness Settings (Jan 14, 2025)
-- ============================================================================

-- Interruption Sensitivity: How sensitive to caller interruptions (0-1)
-- Higher values = stops faster when caller starts speaking
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS interruption_sensitivity numeric(3,2) DEFAULT 0.9;

-- Responsiveness: How quickly to respond after caller stops speaking (0-1)
-- Higher values = responds faster
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS responsiveness numeric(3,2) DEFAULT 0.9;

-- Validate interruption sensitivity is between 0 and 1
ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_interruption_sensitivity;
ALTER TABLE call_settings ADD CONSTRAINT valid_interruption_sensitivity
CHECK (interruption_sensitivity >= 0 AND interruption_sensitivity <= 1);

-- Validate responsiveness is between 0 and 1
ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_responsiveness;
ALTER TABLE call_settings ADD CONSTRAINT valid_responsiveness
CHECK (responsiveness >= 0 AND responsiveness <= 1);

COMMENT ON COLUMN call_settings.interruption_sensitivity IS 'How sensitive to caller interruptions (0-1). Higher = stops faster when caller speaks. Default 0.9 for highly responsive behavior.';
COMMENT ON COLUMN call_settings.responsiveness IS 'How quickly to respond after caller stops speaking (0-1). Higher = responds faster. Default 0.9 for highly responsive behavior.';


-- ============================================================================
-- MIGRATION 10: Add Industry Column (Jan 14, 2025)
-- ============================================================================

-- Add missing industry column to businesses table
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS industry TEXT;

COMMENT ON COLUMN businesses.industry IS 'Business industry/type used for AI prompt customization';


-- ============================================================================
-- MIGRATION 11: Voice Controls (Jan 15, 2025)
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

COMMENT ON COLUMN ai_config.voice_temperature IS 'Voice stability vs expressiveness (0-2). Lower = more consistent, Higher = more varied/emotional. Default 1.0.';
COMMENT ON COLUMN ai_config.voice_speed IS 'Speech rate multiplier (0.5-2). Lower = slower, Higher = faster. Default 1.0.';
COMMENT ON COLUMN ai_config.voice_volume IS 'Output volume level (0-2). Lower = quieter, Higher = louder. Default 1.0.';
COMMENT ON COLUMN ai_config.begin_message_delay_ms IS 'Delay before AI speaks after call connects (0-5000ms). Useful for natural call start. Default 0.';


-- ============================================================================
-- MIGRATION 12: Cleanup Duplicate Volume Column (Jan 16, 2025)
-- ============================================================================

-- Drop duplicate volume column if it exists (some schemas had both 'volume' and 'voice_volume')
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


-- ============================================================================
-- DONE! All migrations applied.
-- ============================================================================
SELECT 'All migrations completed successfully!' as status;
