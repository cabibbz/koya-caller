-- Migration: Per-Business Profitability Tracking
--
-- Adds cost tracking and profitability calculations for each business

-- =============================================================================
-- Add platform cost rates to site_settings (configurable)
-- =============================================================================

-- Insert default cost rates if they don't exist
INSERT INTO site_settings (key, value, description)
VALUES
  ('retell_cost_per_minute_cents', '10', 'Retell AI cost per minute in cents'),
  ('twilio_cost_per_minute_cents', '2', 'Twilio telephony cost per minute in cents'),
  ('platform_overhead_percent', '10', 'Platform overhead percentage to add to costs')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- Add cost tracking to calls table (actual cost we pay)
-- =============================================================================

ALTER TABLE calls
ADD COLUMN IF NOT EXISTS platform_cost_cents integer DEFAULT 0;

COMMENT ON COLUMN calls.platform_cost_cents IS
  'Our cost for this call (Retell + Twilio), calculated at call end';

-- =============================================================================
-- Create profitability view for per-business reporting
-- =============================================================================

CREATE OR REPLACE VIEW business_profitability AS
WITH cost_rates AS (
  SELECT
    COALESCE((SELECT value::integer FROM site_settings WHERE key = 'retell_cost_per_minute_cents'), 10) as retell_rate,
    COALESCE((SELECT value::integer FROM site_settings WHERE key = 'twilio_cost_per_minute_cents'), 2) as twilio_rate,
    COALESCE((SELECT value::integer FROM site_settings WHERE key = 'platform_overhead_percent'), 10) as overhead_pct
),
business_usage AS (
  SELECT
    b.id as business_id,
    b.name as business_name,
    b.subscription_status,
    b.current_cycle_start,
    b.current_cycle_end,
    COALESCE(b.minutes_used_this_cycle, 0) as minutes_used,
    COALESCE(b.minutes_included, 0) as minutes_included,
    COALESCE(b.overage_minutes_this_cycle, 0) as overage_minutes,
    COALESCE(b.overage_cost_cents_this_cycle, 0) as overage_revenue_cents,
    COALESCE(p.price_cents, 0) as subscription_cents,
    p.name as plan_name
  FROM businesses b
  LEFT JOIN plans p ON b.plan_id = p.id
  WHERE b.subscription_status IN ('active', 'trialing')
)
SELECT
  bu.business_id,
  bu.business_name,
  bu.subscription_status,
  bu.plan_name,
  bu.current_cycle_start,
  bu.current_cycle_end,

  -- Usage metrics
  bu.minutes_used,
  bu.minutes_included,
  bu.overage_minutes,

  -- Revenue
  bu.subscription_cents,
  bu.overage_revenue_cents,
  (bu.subscription_cents + bu.overage_revenue_cents) as total_revenue_cents,

  -- Costs (minutes × (retell + twilio) × (1 + overhead%))
  ROUND(
    bu.minutes_used * (cr.retell_rate + cr.twilio_rate) * (1 + cr.overhead_pct::numeric / 100)
  )::integer as total_cost_cents,

  -- Profit
  (bu.subscription_cents + bu.overage_revenue_cents) -
  ROUND(
    bu.minutes_used * (cr.retell_rate + cr.twilio_rate) * (1 + cr.overhead_pct::numeric / 100)
  )::integer as profit_cents,

  -- Margin percentage
  CASE
    WHEN (bu.subscription_cents + bu.overage_revenue_cents) > 0 THEN
      ROUND(
        (
          (bu.subscription_cents + bu.overage_revenue_cents) -
          bu.minutes_used * (cr.retell_rate + cr.twilio_rate) * (1 + cr.overhead_pct::numeric / 100)
        ) / (bu.subscription_cents + bu.overage_revenue_cents) * 100,
        1
      )
    ELSE 0
  END as margin_percent,

  -- Cost breakdown
  (bu.minutes_used * cr.retell_rate) as retell_cost_cents,
  (bu.minutes_used * cr.twilio_rate) as twilio_cost_cents,
  cr.retell_rate as retell_rate_cents,
  cr.twilio_rate as twilio_rate_cents

FROM business_usage bu
CROSS JOIN cost_rates cr;

-- =============================================================================
-- Function to get profitability summary
-- =============================================================================

CREATE OR REPLACE FUNCTION get_profitability_summary()
RETURNS TABLE (
  total_businesses integer,
  profitable_businesses integer,
  unprofitable_businesses integer,
  total_revenue_cents bigint,
  total_cost_cents bigint,
  total_profit_cents bigint,
  avg_margin_percent numeric,
  total_minutes_used bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)::integer as total_businesses,
    COUNT(*) FILTER (WHERE profit_cents >= 0)::integer as profitable_businesses,
    COUNT(*) FILTER (WHERE profit_cents < 0)::integer as unprofitable_businesses,
    COALESCE(SUM(total_revenue_cents), 0)::bigint as total_revenue_cents,
    COALESCE(SUM(total_cost_cents), 0)::bigint as total_cost_cents,
    COALESCE(SUM(profit_cents), 0)::bigint as total_profit_cents,
    ROUND(AVG(margin_percent), 1) as avg_margin_percent,
    COALESCE(SUM(minutes_used), 0)::bigint as total_minutes_used
  FROM business_profitability;
$$;

GRANT EXECUTE ON FUNCTION get_profitability_summary() TO service_role;

-- =============================================================================
-- Function to update call platform cost (call this from webhook)
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_call_platform_cost(
  p_call_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_duration_minutes integer;
  v_retell_rate integer;
  v_twilio_rate integer;
  v_overhead_pct integer;
  v_total_cost integer;
BEGIN
  -- Get call duration
  SELECT COALESCE(duration_minutes_billed, 0)
  INTO v_duration_minutes
  FROM calls
  WHERE id = p_call_id;

  IF v_duration_minutes IS NULL OR v_duration_minutes = 0 THEN
    RETURN 0;
  END IF;

  -- Get cost rates
  SELECT COALESCE(value::integer, 10) INTO v_retell_rate
  FROM site_settings WHERE key = 'retell_cost_per_minute_cents';

  SELECT COALESCE(value::integer, 2) INTO v_twilio_rate
  FROM site_settings WHERE key = 'twilio_cost_per_minute_cents';

  SELECT COALESCE(value::integer, 10) INTO v_overhead_pct
  FROM site_settings WHERE key = 'platform_overhead_percent';

  -- Calculate total cost with overhead
  v_total_cost := ROUND(
    v_duration_minutes * (v_retell_rate + v_twilio_rate) * (1 + v_overhead_pct::numeric / 100)
  );

  -- Update the call record
  UPDATE calls
  SET platform_cost_cents = v_total_cost
  WHERE id = p_call_id;

  RETURN v_total_cost;
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_call_platform_cost(uuid) TO service_role;

COMMENT ON FUNCTION calculate_call_platform_cost IS
  'Calculates and stores the platform cost for a call based on configured rates';
