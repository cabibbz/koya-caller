-- Migration: Outbound Calls Infrastructure (Phase 3)
-- Creates tables for outbound calling campaigns, call queue, and DNC list
-- Prerequisites: Run AFTER core_tables.sql and extended_tables.sql

-- ============================================
-- Outbound Campaigns
-- Manages outbound calling campaigns for appointment reminders,
-- follow-ups, marketing, and custom campaigns
-- ============================================
CREATE TABLE outbound_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('appointment_reminder', 'follow_up', 'marketing', 'custom')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled')),
  agent_id text, -- Retell agent ID override
  from_number text, -- Override default business number
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE outbound_campaigns IS 'Outbound calling campaigns for reminders, follow-ups, and marketing';
COMMENT ON COLUMN outbound_campaigns.type IS 'Campaign type: appointment_reminder, follow_up, marketing, custom';
COMMENT ON COLUMN outbound_campaigns.status IS 'Campaign status: draft, scheduled, running, paused, completed, cancelled';
COMMENT ON COLUMN outbound_campaigns.agent_id IS 'Optional Retell agent ID override for this campaign';
COMMENT ON COLUMN outbound_campaigns.settings IS 'Campaign-specific settings JSON';

-- ============================================
-- Outbound Call Queue
-- Individual calls to be made, with retry logic and status tracking
-- ============================================
CREATE TABLE outbound_call_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES outbound_campaigns(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  contact_phone text NOT NULL,
  contact_name text,
  dynamic_variables jsonb DEFAULT '{}',
  priority integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'calling', 'completed', 'failed', 'cancelled', 'dnc_blocked')),
  scheduled_for timestamptz,
  attempt_count integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  last_attempt_at timestamptz,
  last_error text,
  call_id uuid REFERENCES calls(id),
  retell_call_id text,
  outcome text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE outbound_call_queue IS 'Queue of outbound calls to be made with retry logic';
COMMENT ON COLUMN outbound_call_queue.dynamic_variables IS 'Dynamic variables to pass to the AI agent (e.g., appointment details)';
COMMENT ON COLUMN outbound_call_queue.priority IS 'Higher priority calls are made first';
COMMENT ON COLUMN outbound_call_queue.status IS 'Queue item status: pending, scheduled, calling, completed, failed, cancelled, dnc_blocked';
COMMENT ON COLUMN outbound_call_queue.attempt_count IS 'Number of call attempts made';
COMMENT ON COLUMN outbound_call_queue.max_attempts IS 'Maximum number of attempts before marking as failed';

-- ============================================
-- Do Not Call List
-- Maintains DNC list per business for compliance
-- ============================================
CREATE TABLE dnc_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  reason text CHECK (reason IN ('customer_request', 'complaint', 'legal', 'bounced', 'other')),
  source text, -- 'manual', 'api', 'call_request', 'complaint'
  notes text,
  added_by uuid REFERENCES auth.users(id),
  expires_at timestamptz, -- NULL = permanent
  created_at timestamptz DEFAULT now(),
  UNIQUE(business_id, phone_number)
);

COMMENT ON TABLE dnc_list IS 'Do Not Call list for compliance - one per business';
COMMENT ON COLUMN dnc_list.reason IS 'Reason for DNC: customer_request, complaint, legal, bounced, other';
COMMENT ON COLUMN dnc_list.source IS 'How the number was added: manual, api, call_request, complaint';
COMMENT ON COLUMN dnc_list.expires_at IS 'Optional expiration date, NULL means permanent';

-- ============================================
-- Outbound Settings (separate from call_settings for cleaner management)
-- ============================================
CREATE TABLE outbound_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  outbound_enabled boolean DEFAULT false,
  reminder_calls_enabled boolean DEFAULT false,
  reminder_call_24hr boolean DEFAULT true,
  reminder_call_2hr boolean DEFAULT false,
  reminder_call_agent_id text,
  reminder_call_from_number text,
  outbound_daily_limit integer DEFAULT 100,
  outbound_hours_start time DEFAULT '09:00',
  outbound_hours_end time DEFAULT '18:00',
  outbound_days integer[] DEFAULT ARRAY[1,2,3,4,5], -- Mon-Fri by default
  outbound_timezone text DEFAULT 'America/New_York',
  calls_made_today integer DEFAULT 0,
  last_reset_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE outbound_settings IS 'Outbound calling settings per business';
COMMENT ON COLUMN outbound_settings.outbound_enabled IS 'Master switch for outbound calling';
COMMENT ON COLUMN outbound_settings.reminder_calls_enabled IS 'Enable automated reminder calls for appointments';
COMMENT ON COLUMN outbound_settings.reminder_call_24hr IS 'Make reminder call 24 hours before appointment';
COMMENT ON COLUMN outbound_settings.reminder_call_2hr IS 'Make reminder call 2 hours before appointment';
COMMENT ON COLUMN outbound_settings.outbound_daily_limit IS 'Maximum outbound calls per day';
COMMENT ON COLUMN outbound_settings.outbound_hours_start IS 'Start time for outbound calls (in business timezone)';
COMMENT ON COLUMN outbound_settings.outbound_hours_end IS 'End time for outbound calls (in business timezone)';
COMMENT ON COLUMN outbound_settings.outbound_days IS 'Days of week for outbound calls (0=Sun, 6=Sat)';

-- ============================================
-- Extend calls table for outbound tracking
-- ============================================
ALTER TABLE calls ADD COLUMN IF NOT EXISTS direction text DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound'));
ALTER TABLE calls ADD COLUMN IF NOT EXISTS call_type text DEFAULT 'phone' CHECK (call_type IN ('phone', 'web', 'reminder', 'campaign'));
ALTER TABLE calls ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES outbound_campaigns(id);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS queue_item_id uuid REFERENCES outbound_call_queue(id);

COMMENT ON COLUMN calls.direction IS 'Call direction: inbound or outbound';
COMMENT ON COLUMN calls.call_type IS 'Call type: phone, web, reminder, campaign';
COMMENT ON COLUMN calls.campaign_id IS 'Reference to outbound campaign if applicable';
COMMENT ON COLUMN calls.queue_item_id IS 'Reference to queue item for outbound calls';

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX idx_outbound_campaigns_business ON outbound_campaigns(business_id);
CREATE INDEX idx_outbound_campaigns_status ON outbound_campaigns(business_id, status);
CREATE INDEX idx_outbound_queue_business_status ON outbound_call_queue(business_id, status);
CREATE INDEX idx_outbound_queue_scheduled ON outbound_call_queue(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_outbound_queue_pending ON outbound_call_queue(business_id, priority DESC, created_at) WHERE status = 'pending';
CREATE INDEX idx_dnc_business_phone ON dnc_list(business_id, phone_number);
CREATE INDEX idx_dnc_expires ON dnc_list(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_calls_direction ON calls(business_id, direction);
CREATE INDEX idx_calls_campaign ON calls(campaign_id) WHERE campaign_id IS NOT NULL;

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE outbound_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_call_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE dnc_list ENABLE ROW LEVEL SECURITY;

-- Outbound settings policies
CREATE POLICY "Users can manage their business outbound settings" ON outbound_settings
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Service role bypass outbound_settings" ON outbound_settings
  FOR ALL USING (auth.role() = 'service_role');

-- Outbound campaigns policies
CREATE POLICY "Users can manage their business outbound campaigns" ON outbound_campaigns
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Service role bypass outbound_campaigns" ON outbound_campaigns
  FOR ALL USING (auth.role() = 'service_role');

-- Outbound call queue policies
CREATE POLICY "Users can manage their business call queue" ON outbound_call_queue
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Service role bypass outbound_call_queue" ON outbound_call_queue
  FOR ALL USING (auth.role() = 'service_role');

-- DNC list policies
CREATE POLICY "Users can manage their business DNC list" ON dnc_list
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Service role bypass dnc_list" ON dnc_list
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Helper function to check if number is on DNC
-- ============================================
CREATE OR REPLACE FUNCTION is_on_dnc(p_business_id uuid, p_phone text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM dnc_list
    WHERE business_id = p_business_id
    AND phone_number = p_phone
    AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_on_dnc IS 'Check if a phone number is on the DNC list for a business';

-- ============================================
-- Function to add number to DNC list
-- ============================================
CREATE OR REPLACE FUNCTION add_to_dnc(
  p_business_id uuid,
  p_phone text,
  p_reason text DEFAULT 'customer_request',
  p_source text DEFAULT 'api',
  p_notes text DEFAULT NULL,
  p_added_by uuid DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_dnc_id uuid;
BEGIN
  INSERT INTO dnc_list (
    business_id, phone_number, reason, source, notes, added_by, expires_at
  ) VALUES (
    p_business_id, p_phone, p_reason, p_source, p_notes, p_added_by, p_expires_at
  )
  ON CONFLICT (business_id, phone_number)
  DO UPDATE SET
    reason = EXCLUDED.reason,
    source = EXCLUDED.source,
    notes = COALESCE(EXCLUDED.notes, dnc_list.notes),
    added_by = COALESCE(EXCLUDED.added_by, dnc_list.added_by),
    expires_at = EXCLUDED.expires_at
  RETURNING id INTO v_dnc_id;

  -- Also cancel any pending queue items for this number
  UPDATE outbound_call_queue
  SET status = 'dnc_blocked', updated_at = now()
  WHERE business_id = p_business_id
    AND contact_phone = p_phone
    AND status IN ('pending', 'scheduled');

  RETURN v_dnc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION add_to_dnc IS 'Add a phone number to the DNC list and cancel pending calls';

-- ============================================
-- Updated at triggers
-- ============================================
CREATE TRIGGER update_outbound_settings_updated_at
  BEFORE UPDATE ON outbound_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outbound_campaigns_updated_at
  BEFORE UPDATE ON outbound_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outbound_call_queue_updated_at
  BEFORE UPDATE ON outbound_call_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
