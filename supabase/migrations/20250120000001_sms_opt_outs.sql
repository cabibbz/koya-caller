-- SMS Opt-Outs - TCPA Compliance Tracking
-- Tracks customer SMS opt-out/opt-in status per business for TCPA compliance
-- This supplements Twilio's automatic STOP handling with internal tracking

CREATE TABLE IF NOT EXISTS sms_opt_outs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    opted_back_in_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    opt_out_keyword TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'sms',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(business_id, phone_number)
);

-- Partial index for efficient lookups of active opt-outs
CREATE INDEX idx_sms_opt_outs_lookup
ON sms_opt_outs(business_id, phone_number)
WHERE is_active = TRUE;

-- Index for listing all opt-outs for a business
CREATE INDEX idx_sms_opt_outs_business_id ON sms_opt_outs(business_id);

-- Add comments explaining the table
COMMENT ON TABLE sms_opt_outs IS 'Tracks SMS opt-out status for TCPA compliance. Supplements Twilio auto-handling with internal tracking.';
COMMENT ON COLUMN sms_opt_outs.phone_number IS 'Phone number in E.164 format (e.g., +14155551234)';
COMMENT ON COLUMN sms_opt_outs.opted_out_at IS 'Timestamp when the user opted out';
COMMENT ON COLUMN sms_opt_outs.opted_back_in_at IS 'Timestamp when the user opted back in (if applicable)';
COMMENT ON COLUMN sms_opt_outs.is_active IS 'TRUE if currently opted out, FALSE if opted back in';
COMMENT ON COLUMN sms_opt_outs.opt_out_keyword IS 'The keyword used to opt out (e.g., STOP, UNSUBSCRIBE)';
COMMENT ON COLUMN sms_opt_outs.source IS 'How the opt-out was received (sms, web, api)';

-- Enable RLS
ALTER TABLE sms_opt_outs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own business SMS opt-outs" ON sms_opt_outs
  FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own business SMS opt-outs" ON sms_opt_outs
  FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own business SMS opt-outs" ON sms_opt_outs
  FOR UPDATE USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Service role bypass sms_opt_outs" ON sms_opt_outs
  FOR ALL USING (auth.role() = 'service_role');
