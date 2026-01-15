-- Migration: Multi-Location Support (MVP)
-- Add location tracking to phone numbers

-- Add location_name to phone_numbers
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS location_address TEXT;

COMMENT ON COLUMN phone_numbers.location_name IS 'Name of the location this phone serves (e.g., Downtown Office, North Branch)';
COMMENT ON COLUMN phone_numbers.location_address IS 'Address of this location';

-- Add location tracking to calls
ALTER TABLE calls ADD COLUMN IF NOT EXISTS location_name TEXT;

-- Create a view for location-based call stats
CREATE OR REPLACE VIEW location_call_stats AS
SELECT
  c.business_id,
  COALESCE(p.location_name, 'Main') as location_name,
  COUNT(*) as total_calls,
  COUNT(CASE WHEN c.outcome = 'booked' THEN 1 END) as booked_calls,
  COUNT(CASE WHEN c.outcome = 'transferred' THEN 1 END) as transferred_calls,
  SUM(COALESCE(c.duration_seconds, 0)) as total_duration_seconds,
  MAX(c.started_at) as last_call_at
FROM calls c
LEFT JOIN phone_numbers p ON c.to_number = p.number
GROUP BY c.business_id, COALESCE(p.location_name, 'Main');
