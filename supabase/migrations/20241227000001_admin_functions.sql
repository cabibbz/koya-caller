-- Migration: Admin Dashboard Functions (Session: Admin Dashboard)
-- Spec Reference: Part 8, Lines 808-850
-- Admin-only views and functions for internal dashboard

-- ============================================
-- Admin Check Function
-- Used by RLS policies to verify admin access
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_status BOOLEAN;
BEGIN
  SELECT (raw_app_meta_data->>'is_admin')::boolean INTO admin_status
  FROM auth.users
  WHERE id = auth.uid();
  RETURN COALESCE(admin_status, FALSE);
END;
$$;

COMMENT ON FUNCTION public.is_admin_user() IS 'Check if current user is an admin via app_metadata';

-- ============================================
-- Admin Metrics View
-- Aggregated stats for admin dashboard
-- ============================================
CREATE OR REPLACE VIEW admin_business_metrics AS
SELECT
  b.id AS business_id,
  b.name AS business_name,
  b.subscription_status,
  b.created_at,
  b.updated_at,
  p.name AS plan_name,
  p.price_cents AS plan_price,
  b.minutes_used_this_cycle,
  b.minutes_included,
  CASE
    WHEN b.minutes_included > 0
    THEN ROUND((b.minutes_used_this_cycle::numeric / b.minutes_included) * 100, 1)
    ELSE 0
  END AS usage_percent,
  (SELECT COUNT(*) FROM calls c WHERE c.business_id = b.id) AS total_calls,
  (SELECT COUNT(*) FROM calls c WHERE c.business_id = b.id AND c.outcome IN ('booked', 'transferred', 'info', 'message')) AS completed_calls,
  (SELECT COUNT(*) FROM calls c WHERE c.business_id = b.id AND c.outcome IN ('missed', 'minutes_exhausted')) AS failed_calls,
  (SELECT COUNT(*) FROM appointments a WHERE a.business_id = b.id) AS total_appointments,
  (SELECT SUM(c.duration_seconds) FROM calls c WHERE c.business_id = b.id) AS total_call_seconds,
  u.email AS owner_email,
  u.phone AS owner_phone
FROM businesses b
LEFT JOIN plans p ON b.plan_id = p.id
LEFT JOIN users u ON b.user_id = u.id;

COMMENT ON VIEW admin_business_metrics IS 'Comprehensive business metrics for admin dashboard';

-- ============================================
-- Admin Health Metrics View
-- Churn risk and health indicators
-- ============================================
CREATE OR REPLACE VIEW admin_health_metrics AS
SELECT
  b.id AS business_id,
  b.name AS business_name,
  b.subscription_status,
  b.updated_at AS last_activity,
  -- Days since last activity
  EXTRACT(DAY FROM NOW() - COALESCE(
    (SELECT MAX(c.created_at) FROM calls c WHERE c.business_id = b.id),
    b.created_at
  )) AS days_since_last_call,
  -- Usage trend
  b.minutes_used_this_cycle,
  b.minutes_included,
  -- Churn risk indicators
  CASE
    WHEN b.subscription_status = 'cancelled' THEN 'churned'
    WHEN b.subscription_status = 'paused' THEN 'high'
    WHEN EXTRACT(DAY FROM NOW() - COALESCE(
      (SELECT MAX(c.created_at) FROM calls c WHERE c.business_id = b.id),
      b.created_at
    )) > 14 THEN 'high'
    WHEN EXTRACT(DAY FROM NOW() - COALESCE(
      (SELECT MAX(c.created_at) FROM calls c WHERE c.business_id = b.id),
      b.created_at
    )) > 7 THEN 'medium'
    ELSE 'low'
  END AS churn_risk,
  -- Upsell opportunity
  CASE
    WHEN b.minutes_included > 0 AND (b.minutes_used_this_cycle::numeric / b.minutes_included) > 0.8
    THEN TRUE
    ELSE FALSE
  END AS upsell_candidate,
  -- Failed calls ratio
  CASE
    WHEN (SELECT COUNT(*) FROM calls c WHERE c.business_id = b.id) > 0
    THEN ROUND(
      (SELECT COUNT(*) FROM calls c WHERE c.business_id = b.id AND c.outcome IN ('missed', 'minutes_exhausted'))::numeric /
      (SELECT COUNT(*) FROM calls c WHERE c.business_id = b.id) * 100, 1
    )
    ELSE 0
  END AS failed_call_percent
FROM businesses b
WHERE b.subscription_status IN ('active', 'paused', 'cancelled');

COMMENT ON VIEW admin_health_metrics IS 'Business health indicators for churn prevention';

-- ============================================
-- Admin Financial Summary Function
-- Calculate MRR, ARPU, and other financial metrics
-- ============================================
CREATE OR REPLACE FUNCTION get_admin_financial_summary()
RETURNS TABLE (
  total_mrr_cents BIGINT,
  total_customers INT,
  active_customers INT,
  churned_customers INT,
  arpu_cents NUMERIC,
  new_customers_30d INT,
  churned_customers_30d INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(p.price_cents), 0)::BIGINT AS total_mrr_cents,
    COUNT(DISTINCT b.id)::INT AS total_customers,
    COUNT(DISTINCT CASE WHEN b.subscription_status = 'active' THEN b.id END)::INT AS active_customers,
    COUNT(DISTINCT CASE WHEN b.subscription_status = 'cancelled' THEN b.id END)::INT AS churned_customers,
    CASE
      WHEN COUNT(DISTINCT CASE WHEN b.subscription_status = 'active' THEN b.id END) > 0
      THEN ROUND(SUM(CASE WHEN b.subscription_status = 'active' THEN p.price_cents ELSE 0 END)::numeric /
           COUNT(DISTINCT CASE WHEN b.subscription_status = 'active' THEN b.id END), 0)
      ELSE 0
    END AS arpu_cents,
    COUNT(DISTINCT CASE WHEN b.created_at > NOW() - INTERVAL '30 days' THEN b.id END)::INT AS new_customers_30d,
    COUNT(DISTINCT CASE WHEN b.subscription_status = 'cancelled' AND b.updated_at > NOW() - INTERVAL '30 days' THEN b.id END)::INT AS churned_customers_30d
  FROM businesses b
  LEFT JOIN plans p ON b.plan_id = p.id
  WHERE b.subscription_status != 'onboarding';
END;
$$;

COMMENT ON FUNCTION get_admin_financial_summary() IS 'Calculate admin financial dashboard metrics';

-- ============================================
-- RLS Policies for Admin Access
-- Admins can view all data
-- ============================================

-- Enable RLS on views (if not already)
-- Note: Views inherit RLS from underlying tables
-- These policies allow admins to bypass normal tenant restrictions

-- Grant admin access to business metrics
CREATE POLICY "Admins can view all business metrics"
  ON businesses
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

-- Grant admin access to call data
CREATE POLICY "Admins can view all calls"
  ON calls
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

-- Grant admin access to appointments
CREATE POLICY "Admins can view all appointments"
  ON appointments
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());
