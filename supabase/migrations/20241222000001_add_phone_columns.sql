-- Migration: Add phone columns to businesses table (Session 12/13)
-- These columns store the Twilio phone number assigned to each business

-- Add phone_number column (the actual phone number in E.164 format)
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS phone_number text;

-- Add twilio_phone_sid column (Twilio's unique identifier for the number)
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS twilio_phone_sid text;

-- Add comments
COMMENT ON COLUMN businesses.phone_number IS 'Twilio phone number assigned to this business (E.164 format, e.g., +14155551234)';
COMMENT ON COLUMN businesses.twilio_phone_sid IS 'Twilio Phone Number SID for API operations';

-- Create index for looking up business by phone number (for incoming calls)
CREATE INDEX IF NOT EXISTS idx_businesses_phone_number ON businesses(phone_number);
