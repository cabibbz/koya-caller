-- Add email_missed column for missed call email notifications
-- This column was missing, causing the Inngest function to query a non-existent column

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS email_missed boolean DEFAULT true;

COMMENT ON COLUMN notification_settings.email_missed IS 'Send email alert when a call is missed';
