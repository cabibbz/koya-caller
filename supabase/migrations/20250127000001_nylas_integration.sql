-- =============================================
-- Nylas Integration Migration
-- Adds Nylas grant columns to calendar_integrations
-- and scheduler support tables
-- =============================================

-- Add Nylas columns to calendar_integrations
ALTER TABLE calendar_integrations
  ADD COLUMN IF NOT EXISTS grant_id TEXT,
  ADD COLUMN IF NOT EXISTS grant_email TEXT,
  ADD COLUMN IF NOT EXISTS grant_provider TEXT,
  ADD COLUMN IF NOT EXISTS grant_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS scheduler_config_id TEXT,
  ADD COLUMN IF NOT EXISTS nylas_calendar_id TEXT;

-- Index for grant lookups
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_grant_id
  ON calendar_integrations(grant_id) WHERE grant_id IS NOT NULL;

-- Add Nylas tracking to appointments
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS nylas_event_id TEXT,
  ADD COLUMN IF NOT EXISTS nylas_booking_id TEXT,
  ADD COLUMN IF NOT EXISTS conferencing_link TEXT;

-- Index for Nylas booking lookups (used by webhooks)
CREATE INDEX IF NOT EXISTS idx_appointments_nylas_booking_id
  ON appointments(nylas_booking_id) WHERE nylas_booking_id IS NOT NULL;

-- Scheduler configurations (business booking page settings)
CREATE TABLE IF NOT EXISTS scheduler_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  nylas_config_id TEXT,
  name TEXT NOT NULL DEFAULT 'Default',
  services JSONB DEFAULT '[]',
  conferencing_provider TEXT,
  booking_form_fields JSONB DEFAULT '[]',
  confirmation_message TEXT,
  custom_css TEXT,
  custom_domain TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, name)
);

-- RLS for scheduler_configs
ALTER TABLE scheduler_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scheduler configs"
  ON scheduler_configs FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their own scheduler configs"
  ON scheduler_configs FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));
