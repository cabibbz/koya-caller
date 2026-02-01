-- Fix call direction constraint and data
-- Continuation of 20250125000001 fixes

-- Add constraint for valid values if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_call_direction'
  ) THEN
    ALTER TABLE calls ADD CONSTRAINT valid_call_direction
      CHECK (direction IN ('inbound', 'outbound'));
  END IF;
END $$;

-- Create index for filtering by direction
CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(direction);

-- Update existing calls - try to infer direction from outbound tables
-- Calls linked to campaign_calls are outbound (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_calls') THEN
    UPDATE calls c
    SET direction = 'outbound'
    FROM campaign_calls cc
    WHERE c.id = cc.call_id
    AND (c.direction IS NULL OR c.direction = 'inbound');
  END IF;
END $$;

-- Fix swapped phone numbers for inbound calls
-- If from_number matches a business phone number and to_number doesn't, swap them
-- This fixes cases where Retell sent the numbers in the wrong order
UPDATE calls c
SET from_number = c.to_number,
    to_number = c.from_number
FROM phone_numbers pn
WHERE c.from_number = pn.number
  AND c.business_id = pn.business_id
  AND c.direction = 'inbound'
  AND c.to_number IS NOT NULL
  AND c.to_number != pn.number;

-- Fix call outcomes for calls that resulted in appointments
-- If a call has an appointment linked to it, the outcome should be "booked"
UPDATE calls c
SET outcome = 'booked'
FROM appointments a
WHERE a.call_id = c.id
  AND a.status != 'cancelled'
  AND (c.outcome IS NULL OR c.outcome != 'booked');
