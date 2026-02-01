-- Migration: Enhanced Usage Increment Function
--
-- Replaces the basic increment_usage_minutes function with an enhanced version that:
-- 1. Tracks overage when exceeding included minutes
-- 2. Calculates overage cost at the business's configured rate
-- 3. Logs all changes to the usage_audit_log table
-- 4. Optionally updates the call's cost_cents field

-- =============================================================================
-- Drop existing functions first to allow return type change
-- =============================================================================

-- Drop ALL versions of these functions (different parameter counts)
-- Use CASCADE to handle any dependencies
DROP FUNCTION IF EXISTS increment_minutes_used(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS increment_minutes_used(uuid, integer, uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS increment_usage_minutes(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS increment_usage_minutes(uuid, integer, uuid, text, text) CASCADE;

-- =============================================================================
-- Enhanced increment_usage_minutes function
-- =============================================================================

CREATE OR REPLACE FUNCTION increment_usage_minutes(
  p_business_id uuid,
  p_minutes integer,
  p_call_id uuid DEFAULT NULL,
  p_source text DEFAULT 'webhook',
  p_source_reference text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  minutes_used_this_cycle integer,
  current_cycle_start date,
  current_cycle_end date,
  overage_minutes integer,
  overage_cost_cents integer,
  is_overage boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business RECORD;
  v_minutes_before integer;
  v_minutes_after integer;
  v_included_minutes integer;
  v_overage_minutes integer := 0;
  v_overage_cost integer := 0;
  v_is_overage boolean := false;
  v_call_cost integer := 0;
BEGIN
  -- Validate input
  IF p_minutes <= 0 THEN
    RAISE EXCEPTION 'Minutes must be positive';
  END IF;

  IF p_minutes > 1440 THEN
    RAISE EXCEPTION 'Minutes increment exceeds maximum allowed (1440)';
  END IF;

  -- Get current business state with lock
  SELECT
    b.id,
    b.name,
    COALESCE(b.minutes_used_this_cycle, 0) as minutes_used,
    COALESCE(b.minutes_included, 200) as minutes_included,
    b.current_cycle_start,
    b.current_cycle_end,
    COALESCE(b.overage_rate_cents, 15) as overage_rate,
    COALESCE(b.overage_minutes_this_cycle, 0) as overage_minutes,
    COALESCE(b.overage_cost_cents_this_cycle, 0) as overage_cost,
    COALESCE(b.overage_billing_enabled, false) as overage_enabled
  INTO v_business
  FROM businesses b
  WHERE b.id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found: %', p_business_id;
  END IF;

  v_minutes_before := v_business.minutes_used;
  v_included_minutes := v_business.minutes_included;
  v_minutes_after := v_minutes_before + p_minutes;

  -- Calculate overage if exceeding limit
  IF v_minutes_after > v_included_minutes THEN
    v_is_overage := true;

    -- Calculate how many of the new minutes are overage
    IF v_minutes_before >= v_included_minutes THEN
      -- Already in overage, all new minutes are overage
      v_overage_minutes := p_minutes;
    ELSE
      -- Crossing into overage, only count the excess
      v_overage_minutes := v_minutes_after - v_included_minutes;
    END IF;

    v_overage_cost := v_overage_minutes * v_business.overage_rate;
    v_call_cost := v_overage_cost;
  END IF;

  -- Update business record
  UPDATE businesses
  SET
    minutes_used_this_cycle = v_minutes_after,
    overage_minutes_this_cycle = COALESCE(overage_minutes_this_cycle, 0) + v_overage_minutes,
    overage_cost_cents_this_cycle = COALESCE(overage_cost_cents_this_cycle, 0) + v_overage_cost,
    updated_at = now()
  WHERE businesses.id = p_business_id;

  -- Update call cost if call_id provided
  IF p_call_id IS NOT NULL AND v_call_cost > 0 THEN
    UPDATE calls
    SET cost_cents = v_call_cost
    WHERE calls.id = p_call_id;
  END IF;

  -- Log to audit table
  INSERT INTO usage_audit_log (
    business_id,
    call_id,
    event_type,
    minutes_before,
    minutes_after,
    minutes_delta,
    cost_cents,
    is_overage,
    source,
    source_reference
  ) VALUES (
    p_business_id,
    p_call_id,
    CASE WHEN v_is_overage THEN 'overage_charged' ELSE 'minutes_increment' END,
    v_minutes_before,
    v_minutes_after,
    p_minutes,
    v_call_cost,
    v_is_overage,
    p_source,
    p_source_reference
  );

  -- Return updated values
  RETURN QUERY
  SELECT
    v_business.id,
    v_business.name,
    v_minutes_after,
    v_business.current_cycle_start,
    v_business.current_cycle_end,
    v_overage_minutes,
    v_overage_cost,
    v_is_overage;
END;
$$;

-- Update the alias function to match new signature
CREATE OR REPLACE FUNCTION increment_minutes_used(
  p_business_id uuid,
  p_minutes integer,
  p_call_id uuid DEFAULT NULL,
  p_source text DEFAULT 'webhook',
  p_source_reference text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  minutes_used_this_cycle integer,
  current_cycle_start date,
  current_cycle_end date,
  overage_minutes integer,
  overage_cost_cents integer,
  is_overage boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM increment_usage_minutes(p_business_id, p_minutes, p_call_id, p_source, p_source_reference);
$$;

-- =============================================================================
-- Reconciliation helper function
-- =============================================================================

CREATE OR REPLACE FUNCTION reconcile_business_usage(
  p_business_id uuid,
  p_admin_id uuid DEFAULT NULL
)
RETURNS TABLE (
  business_id uuid,
  business_name text,
  recorded_minutes integer,
  actual_minutes integer,
  difference integer,
  fixed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business RECORD;
  v_actual_minutes integer;
  v_difference integer;
BEGIN
  -- Get business with current recorded usage
  SELECT
    b.id,
    b.name,
    COALESCE(b.minutes_used_this_cycle, 0) as recorded,
    b.current_cycle_start
  INTO v_business
  FROM businesses b
  WHERE b.id = p_business_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found: %', p_business_id;
  END IF;

  -- Calculate actual usage from calls table
  SELECT COALESCE(SUM(duration_minutes_billed), 0)
  INTO v_actual_minutes
  FROM calls
  WHERE calls.business_id = p_business_id
    AND calls.started_at >= v_business.current_cycle_start;

  v_difference := v_business.recorded - v_actual_minutes;

  -- If there's a difference, fix it and log
  IF v_difference != 0 THEN
    -- Update business record
    UPDATE businesses
    SET
      minutes_used_this_cycle = v_actual_minutes,
      updated_at = now()
    WHERE businesses.id = p_business_id;

    -- Log the reconciliation
    INSERT INTO usage_audit_log (
      business_id,
      event_type,
      minutes_before,
      minutes_after,
      minutes_delta,
      source,
      source_reference,
      notes,
      created_by
    ) VALUES (
      p_business_id,
      'reconciliation',
      v_business.recorded,
      v_actual_minutes,
      v_difference,
      'reconciliation',
      'reconcile_business_usage',
      format('Automated reconciliation: recorded=%s, actual=%s, diff=%s',
             v_business.recorded, v_actual_minutes, v_difference),
      p_admin_id
    );

    RETURN QUERY SELECT
      v_business.id,
      v_business.name,
      v_business.recorded,
      v_actual_minutes,
      v_difference,
      true;
  ELSE
    RETURN QUERY SELECT
      v_business.id,
      v_business.name,
      v_business.recorded,
      v_actual_minutes,
      v_difference,
      false;
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION increment_usage_minutes(uuid, integer, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_usage_minutes(uuid, integer, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION increment_minutes_used(uuid, integer, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_minutes_used(uuid, integer, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION reconcile_business_usage(uuid, uuid) TO service_role;

COMMENT ON FUNCTION increment_usage_minutes(uuid, integer, uuid, text, text) IS
  'Enhanced usage increment with overage tracking and audit logging';

COMMENT ON FUNCTION reconcile_business_usage(uuid, uuid) IS
  'Reconciles business usage by comparing recorded vs actual call minutes';
