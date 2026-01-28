-- Migration: HubSpot OAuth State Columns
-- Temporary storage for OAuth CSRF protection

-- Add OAuth state columns to businesses table
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS hubspot_oauth_state text,
ADD COLUMN IF NOT EXISTS hubspot_oauth_state_expires timestamptz;

COMMENT ON COLUMN businesses.hubspot_oauth_state IS 'Temporary OAuth state for CSRF protection during HubSpot connection';
COMMENT ON COLUMN businesses.hubspot_oauth_state_expires IS 'Expiration time for the OAuth state (10 minutes)';

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_businesses_hubspot_oauth_state_expires
ON businesses(hubspot_oauth_state_expires)
WHERE hubspot_oauth_state IS NOT NULL;
