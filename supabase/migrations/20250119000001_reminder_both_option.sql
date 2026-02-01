-- Add 'both' option for appointment reminders
-- Allows businesses to send both 1-hour and 24-hour reminders

-- Drop the old constraint
ALTER TABLE notification_settings
DROP CONSTRAINT IF EXISTS valid_reminder;

-- Add the updated constraint with 'both' option
ALTER TABLE notification_settings
ADD CONSTRAINT valid_reminder CHECK (sms_customer_reminder IN ('off', '1hr', '24hr', 'both'));

-- Fix column naming in appointments table (use hr not h)
-- Note: This is a no-op if columns already have correct names from migration 20250113000001
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'appointments' AND column_name = 'reminder_1h_sent_at') THEN
    ALTER TABLE appointments RENAME COLUMN reminder_1h_sent_at TO reminder_1hr_sent_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'appointments' AND column_name = 'reminder_24h_sent_at') THEN
    ALTER TABLE appointments RENAME COLUMN reminder_24h_sent_at TO reminder_24hr_sent_at;
  END IF;
END $$;

COMMENT ON CONSTRAINT valid_reminder ON notification_settings IS
  'Customer reminder options: off, 1hr (1 hour before), 24hr (24 hours before), both (1hr and 24hr)';
