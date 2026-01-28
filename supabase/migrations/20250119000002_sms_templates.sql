-- SMS Templates - Customizable notification messages
-- Allows businesses to customize their SMS notification text

CREATE TABLE IF NOT EXISTS sms_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,

  -- Customer-facing templates (sent to customers)
  booking_confirmation text,
  reminder_24hr text,
  reminder_1hr text,

  -- Owner-facing templates (sent to business owner)
  missed_call_alert text,
  message_alert text,
  transfer_alert text,

  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Add comments explaining available variables
COMMENT ON TABLE sms_templates IS 'Customizable SMS notification templates per business';
COMMENT ON COLUMN sms_templates.booking_confirmation IS 'Template for appointment confirmation. Variables: {{business_name}}, {{service_name}}, {{date_time}}, {{customer_name}}';
COMMENT ON COLUMN sms_templates.reminder_24hr IS 'Template for 24-hour reminder. Variables: {{business_name}}, {{service_name}}, {{date_time}}, {{customer_name}}';
COMMENT ON COLUMN sms_templates.reminder_1hr IS 'Template for 1-hour reminder. Variables: {{business_name}}, {{service_name}}, {{date_time}}, {{customer_name}}';
COMMENT ON COLUMN sms_templates.missed_call_alert IS 'Template for missed call alert to owner. Variables: {{caller_name}}, {{caller_phone}}, {{call_time}}';
COMMENT ON COLUMN sms_templates.message_alert IS 'Template for message alert to owner. Variables: {{caller_name}}, {{caller_phone}}, {{message}}';
COMMENT ON COLUMN sms_templates.transfer_alert IS 'Template for transfer alert to owner. Variables: {{caller_name}}, {{caller_phone}}, {{reason}}';

-- Enable RLS
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own business SMS templates" ON sms_templates
  FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own business SMS templates" ON sms_templates
  FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own business SMS templates" ON sms_templates
  FOR UPDATE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Service role bypass sms_templates" ON sms_templates
  FOR ALL USING (auth.role() = 'service_role');

-- Index
CREATE INDEX IF NOT EXISTS idx_sms_templates_business_id ON sms_templates(business_id);
