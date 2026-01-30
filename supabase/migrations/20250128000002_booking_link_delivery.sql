-- Add booking_link_delivery preference to businesses table
-- This controls how Koya sends the booking link: 'sms', 'email', or 'both'

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS booking_link_delivery TEXT DEFAULT 'sms';

-- Add a comment for documentation
COMMENT ON COLUMN businesses.booking_link_delivery IS 'How to send booking link to callers: sms, email, or both';
