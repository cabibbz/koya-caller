-- ============================================
-- Add email campaign type to outbound_campaigns
-- ============================================

-- Drop the existing constraint and add new one with 'email' type
ALTER TABLE outbound_campaigns
DROP CONSTRAINT IF EXISTS outbound_campaigns_type_check;

ALTER TABLE outbound_campaigns
ADD CONSTRAINT outbound_campaigns_type_check
CHECK (type IN ('appointment_reminder', 'follow_up', 'marketing', 'custom', 'email'));

-- Add comment
COMMENT ON COLUMN outbound_campaigns.type IS 'Campaign type: appointment_reminder, follow_up, marketing, custom, or email';
