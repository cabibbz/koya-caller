-- Migration: Multi-Calendar Support
-- Allow businesses to connect multiple calendar providers (Google + Microsoft)

-- Step 1: Drop the unique constraint on business_id
-- This allows multiple calendar integrations per business
ALTER TABLE calendar_integrations
  DROP CONSTRAINT IF EXISTS calendar_integrations_business_id_key;

-- Step 2: Add a unique constraint on (business_id, provider)
-- This ensures only one integration per provider per business
ALTER TABLE calendar_integrations
  ADD CONSTRAINT calendar_integrations_business_provider_unique
  UNIQUE (business_id, provider);

-- Step 3: Add is_primary column to designate the primary calendar for availability
ALTER TABLE calendar_integrations
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Step 4: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_business_provider
  ON calendar_integrations(business_id, provider);

CREATE INDEX IF NOT EXISTS idx_calendar_integrations_business_active
  ON calendar_integrations(business_id, grant_status)
  WHERE grant_status = 'active';

-- Step 5: Update comment
COMMENT ON TABLE calendar_integrations IS 'Calendar provider integrations (multiple per business allowed)';

-- Step 6: Function to ensure at least one primary calendar exists
CREATE OR REPLACE FUNCTION ensure_primary_calendar()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is the first active calendar for the business, make it primary
  IF NEW.grant_status = 'active' THEN
    IF NOT EXISTS (
      SELECT 1 FROM calendar_integrations
      WHERE business_id = NEW.business_id
      AND is_primary = true
      AND grant_status = 'active'
      AND id != NEW.id
    ) THEN
      NEW.is_primary := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger
DROP TRIGGER IF EXISTS trigger_ensure_primary_calendar ON calendar_integrations;
CREATE TRIGGER trigger_ensure_primary_calendar
  BEFORE INSERT OR UPDATE ON calendar_integrations
  FOR EACH ROW
  EXECUTE FUNCTION ensure_primary_calendar();
