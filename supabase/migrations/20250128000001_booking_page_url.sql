-- Add booking_page_url to businesses table
-- This allows businesses to specify an external booking page URL
-- (e.g., Vagaro, Square Appointments, Calendly) that Koya can send to callers

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS booking_page_url TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN businesses.booking_page_url IS 'External booking page URL (e.g., Vagaro, Square, Calendly) that Koya sends to callers when they want to book';
