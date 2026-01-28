-- Migration: Trial Period Support
-- Adds trial period tracking columns to businesses table
-- Implements trial enforcement for new signups

-- ============================================
-- Add trial columns to businesses table
-- ============================================

-- trial_ends_at: When the 14-day trial expires
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- trial_minutes_limit: Maximum minutes allowed during trial (default 30)
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS trial_minutes_limit INTEGER DEFAULT 30;

-- trial_minutes_used: Minutes consumed during trial period
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS trial_minutes_used INTEGER DEFAULT 0;

-- trial_email_3day_sent: Track if 3-day warning email was sent
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS trial_email_3day_sent BOOLEAN DEFAULT FALSE;

-- trial_email_1day_sent: Track if 1-day warning email was sent
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS trial_email_1day_sent BOOLEAN DEFAULT FALSE;

-- trial_email_expired_sent: Track if expiry email was sent
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS trial_email_expired_sent BOOLEAN DEFAULT FALSE;

-- Add comments
COMMENT ON COLUMN businesses.trial_ends_at IS 'Timestamp when the 14-day trial period expires';
COMMENT ON COLUMN businesses.trial_minutes_limit IS 'Maximum AI minutes allowed during trial (default 30)';
COMMENT ON COLUMN businesses.trial_minutes_used IS 'AI minutes consumed during trial period';
COMMENT ON COLUMN businesses.trial_email_3day_sent IS 'Whether the 3-day trial warning email has been sent';
COMMENT ON COLUMN businesses.trial_email_1day_sent IS 'Whether the 1-day trial warning email has been sent';
COMMENT ON COLUMN businesses.trial_email_expired_sent IS 'Whether the trial expired email has been sent';

-- ============================================
-- Create index for trial expiry queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_businesses_trial_ends_at
ON businesses(trial_ends_at)
WHERE subscription_status = 'trialing' AND trial_ends_at IS NOT NULL;

-- ============================================
-- Function to increment trial minutes used
-- Atomic increment to prevent race conditions
-- ============================================
CREATE OR REPLACE FUNCTION increment_trial_minutes(
  p_business_id UUID,
  p_minutes INTEGER
)
RETURNS TABLE(
  trial_minutes_used INTEGER,
  trial_minutes_limit INTEGER,
  trial_exhausted BOOLEAN
) AS $$
DECLARE
  v_trial_minutes_used INTEGER;
  v_trial_minutes_limit INTEGER;
  v_subscription_status TEXT;
BEGIN
  -- Validate input
  IF p_minutes <= 0 THEN
    RAISE EXCEPTION 'Minutes must be positive';
  END IF;
  IF p_minutes > 60 THEN
    RAISE EXCEPTION 'Single call cannot exceed 60 minutes';
  END IF;

  -- Atomic update with row lock
  UPDATE businesses
  SET trial_minutes_used = COALESCE(trial_minutes_used, 0) + p_minutes
  WHERE id = p_business_id
    AND subscription_status = 'trialing'
  RETURNING
    businesses.trial_minutes_used,
    COALESCE(businesses.trial_minutes_limit, 30),
    businesses.subscription_status
  INTO v_trial_minutes_used, v_trial_minutes_limit, v_subscription_status;

  -- Return updated values
  RETURN QUERY SELECT
    v_trial_minutes_used,
    v_trial_minutes_limit,
    (v_trial_minutes_used >= v_trial_minutes_limit);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to check trial status
-- Returns comprehensive trial information
-- ============================================
CREATE OR REPLACE FUNCTION get_trial_status(p_business_id UUID)
RETURNS TABLE(
  is_trialing BOOLEAN,
  trial_ends_at TIMESTAMPTZ,
  days_remaining INTEGER,
  minutes_used INTEGER,
  minutes_limit INTEGER,
  minutes_remaining INTEGER,
  is_expired BOOLEAN,
  is_minutes_exhausted BOOLEAN
) AS $$
DECLARE
  v_business RECORD;
BEGIN
  SELECT
    b.subscription_status,
    b.trial_ends_at,
    COALESCE(b.trial_minutes_used, 0) as trial_minutes_used,
    COALESCE(b.trial_minutes_limit, 30) as trial_minutes_limit
  INTO v_business
  FROM businesses b
  WHERE b.id = p_business_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      FALSE,
      NULL::TIMESTAMPTZ,
      0,
      0,
      30,
      30,
      TRUE,
      FALSE;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    (v_business.subscription_status = 'trialing'),
    v_business.trial_ends_at,
    GREATEST(0, EXTRACT(DAY FROM (v_business.trial_ends_at - NOW()))::INTEGER),
    v_business.trial_minutes_used,
    v_business.trial_minutes_limit,
    GREATEST(0, v_business.trial_minutes_limit - v_business.trial_minutes_used),
    (v_business.trial_ends_at IS NOT NULL AND v_business.trial_ends_at < NOW()),
    (v_business.trial_minutes_used >= v_business.trial_minutes_limit);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to expire trial
-- Called when trial ends or minutes exhausted
-- ============================================
CREATE OR REPLACE FUNCTION expire_trial(p_business_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE businesses
  SET subscription_status = 'trial_expired'
  WHERE id = p_business_id
    AND subscription_status = 'trialing';
END;
$$ LANGUAGE plpgsql;
