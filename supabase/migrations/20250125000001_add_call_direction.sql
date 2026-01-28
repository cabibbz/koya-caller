-- Add direction column to calls table to properly track inbound vs outbound calls
-- This fixes the issue where caller number was showing as the business number

ALTER TABLE calls ADD COLUMN IF NOT EXISTS direction text DEFAULT 'inbound';

-- Add constraint for valid values (drop if exists first to avoid errors)
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

-- Update existing calls - try to infer direction from metadata or outbound tables
-- Calls linked to outbound_call_queue are outbound
UPDATE calls c
SET direction = 'outbound'
FROM outbound_call_queue ocq
WHERE c.id = ocq.call_id
AND (c.direction IS NULL OR c.direction = 'inbound');

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

COMMENT ON COLUMN calls.direction IS 'Call direction: inbound (customer called business) or outbound (business called customer)';
