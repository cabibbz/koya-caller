-- Migration: Overage Tracking Columns
--
-- Adds columns to businesses table to track overage usage for billing purposes.
-- Overage occurs when a business exceeds their included minutes and continues making calls.

-- =============================================================================
-- Add overage tracking columns to businesses table
-- =============================================================================

-- Overage minutes accumulated this billing cycle
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS overage_minutes_this_cycle integer DEFAULT 0;

-- Total overage cost in cents this cycle
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS overage_cost_cents_this_cycle integer DEFAULT 0;

-- Overage rate in cents per minute (default $0.15/min = 15 cents)
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS overage_rate_cents integer DEFAULT 15;

-- Whether overage billing is enabled for this business
-- When disabled, calls are blocked when limit is reached
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS overage_billing_enabled boolean DEFAULT false;

-- =============================================================================
-- Add cost_cents to calls table for per-call cost tracking
-- =============================================================================

ALTER TABLE calls
ADD COLUMN IF NOT EXISTS cost_cents integer DEFAULT 0;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON COLUMN businesses.overage_minutes_this_cycle IS
  'Number of overage minutes used this billing cycle (beyond included minutes)';

COMMENT ON COLUMN businesses.overage_cost_cents_this_cycle IS
  'Total overage cost in cents accumulated this billing cycle';

COMMENT ON COLUMN businesses.overage_rate_cents IS
  'Cost per overage minute in cents (default 15 = $0.15/min)';

COMMENT ON COLUMN businesses.overage_billing_enabled IS
  'If true, allows overage with billing. If false, blocks calls when limit reached.';

COMMENT ON COLUMN calls.cost_cents IS
  'Cost of this call in cents (0 for included minutes, overage_rate for overage)';
