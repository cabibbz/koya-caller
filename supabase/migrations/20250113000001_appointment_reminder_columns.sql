-- Migration: Add separate reminder tracking columns for appointments
-- Fixes: Appointment reminder system expects separate 1hr and 24hr columns

-- Add separate reminder columns for 1-hour and 24-hour reminders
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS reminder_1hr_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS reminder_24hr_sent_at timestamptz;

-- Migrate existing reminder_sent_at data to reminder_24hr_sent_at (assume they were 24hr reminders)
UPDATE appointments
SET reminder_24hr_sent_at = reminder_sent_at
WHERE reminder_sent_at IS NOT NULL
  AND reminder_24hr_sent_at IS NULL;

-- Add indexes for the new columns to optimize reminder queries
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_1hr
ON appointments(scheduled_at)
WHERE reminder_1hr_sent_at IS NULL AND status = 'confirmed';

CREATE INDEX IF NOT EXISTS idx_appointments_reminder_24hr
ON appointments(scheduled_at)
WHERE reminder_24hr_sent_at IS NULL AND status = 'confirmed';

-- Comment the columns
COMMENT ON COLUMN appointments.reminder_1hr_sent_at IS 'Timestamp when 1-hour reminder SMS was sent';
COMMENT ON COLUMN appointments.reminder_24hr_sent_at IS 'Timestamp when 24-hour reminder SMS was sent';
