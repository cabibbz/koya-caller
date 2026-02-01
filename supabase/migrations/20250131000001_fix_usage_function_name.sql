-- Migration: Fix Usage Function Name Mismatch (CRITICAL BUG FIX)
--
-- This migration fixes critical bugs:
-- 1. Creates missing `increment_outbound_calls_today` function for outbound call limits
-- 2. The `increment_minutes_used` alias is created in migration 20250131000004
--    with enhanced overage tracking and audit logging

-- =============================================================================
-- Create missing increment_outbound_calls_today function
-- =============================================================================

-- This function is called from lib/outbound/index.ts:514 but was never created
-- It increments the daily outbound call counter for rate limiting
CREATE OR REPLACE FUNCTION increment_outbound_calls_today(
  p_business_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Try to update existing record
  UPDATE outbound_settings
  SET
    calls_made_today = COALESCE(calls_made_today, 0) + 1,
    updated_at = now()
  WHERE business_id = p_business_id;

  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO outbound_settings (business_id, calls_made_today)
    VALUES (p_business_id, 1)
    ON CONFLICT (business_id) DO UPDATE
    SET
      calls_made_today = outbound_settings.calls_made_today + 1,
      updated_at = now();
  END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_outbound_calls_today(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_outbound_calls_today(uuid) TO service_role;

COMMENT ON FUNCTION increment_outbound_calls_today IS
  'Increments the daily outbound call counter for rate limiting purposes';
