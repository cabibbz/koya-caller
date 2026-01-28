-- Migration: Add business_integrations table
-- Stores OAuth tokens and settings for third-party integrations
-- Supports: Shopify, Square, Stripe Connect, HubSpot, Salesforce, OpenTable, Mindbody

-- ============================================================================
-- Create business_integrations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'shopify', 'square', 'stripe_connect', 'hubspot', 'salesforce', 'opentable', 'mindbody'
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  shop_domain TEXT, -- For Shopify store domain
  location_id TEXT, -- For Square/OpenTable/Mindbody location
  account_id TEXT, -- For Stripe Connect account ID
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, provider)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_business_integrations_business_id
  ON business_integrations(business_id);

CREATE INDEX IF NOT EXISTS idx_business_integrations_provider
  ON business_integrations(provider);

CREATE INDEX IF NOT EXISTS idx_business_integrations_active
  ON business_integrations(business_id, is_active)
  WHERE is_active = true;

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE business_integrations ENABLE ROW LEVEL SECURITY;

-- Users can view their own business integrations
CREATE POLICY "Users can view own integrations"
  ON business_integrations
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Users can insert integrations for their business
CREATE POLICY "Users can create own integrations"
  ON business_integrations
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Users can update their own integrations
CREATE POLICY "Users can update own integrations"
  ON business_integrations
  FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own integrations
CREATE POLICY "Users can delete own integrations"
  ON business_integrations
  FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything (for OAuth callbacks)
CREATE POLICY "Service role full access"
  ON business_integrations
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- Notify PostgREST to reload schema cache
-- ============================================================================
NOTIFY pgrst, 'reload schema';
