-- Migration: Data Requests for GDPR/CCPA Compliance
-- Implements data export and deletion requests with grace period

-- ============================================
-- Data Requests Table
-- ============================================
CREATE TABLE data_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    business_id UUID REFERENCES businesses(id),
    request_type TEXT NOT NULL, -- 'export', 'deletion'
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, cancelled
    grace_period_ends_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    feedback_reason TEXT,
    export_file_path TEXT, -- Path to exported data file (for export requests)
    export_expires_at TIMESTAMPTZ, -- When the export download link expires
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_request_type CHECK (request_type IN ('export', 'deletion')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'cancelled'))
);

COMMENT ON TABLE data_requests IS 'GDPR/CCPA data export and deletion requests';
COMMENT ON COLUMN data_requests.request_type IS 'Type of request: export (data download) or deletion (account removal)';
COMMENT ON COLUMN data_requests.status IS 'Current status: pending, processing, completed, cancelled';
COMMENT ON COLUMN data_requests.grace_period_ends_at IS 'For deletion requests, when the 14-day grace period ends';
COMMENT ON COLUMN data_requests.feedback_reason IS 'Optional feedback on why the user is leaving';
COMMENT ON COLUMN data_requests.export_file_path IS 'Storage path for exported data ZIP file';
COMMENT ON COLUMN data_requests.export_expires_at IS 'Export download link expiration (48 hours after generation)';

-- Indexes
CREATE INDEX idx_data_requests_user_id ON data_requests(user_id);
CREATE INDEX idx_data_requests_business_id ON data_requests(business_id);
CREATE INDEX idx_data_requests_status ON data_requests(status);
CREATE INDEX idx_data_requests_grace_period ON data_requests(grace_period_ends_at)
    WHERE request_type = 'deletion' AND status = 'pending';

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own data requests" ON data_requests
    FOR SELECT USING (user_id = auth.uid());

-- Users can create their own requests
CREATE POLICY "Users can create own data requests" ON data_requests
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own requests (for cancellation)
CREATE POLICY "Users can update own data requests" ON data_requests
    FOR UPDATE USING (user_id = auth.uid());

-- Service role bypass for background jobs
CREATE POLICY "Service role bypass data_requests" ON data_requests
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Soft Delete Column for Businesses
-- ============================================
ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ;

COMMENT ON COLUMN businesses.deleted_at IS 'When the business was soft-deleted (14-day grace period starts)';
COMMENT ON COLUMN businesses.deletion_scheduled_at IS 'When permanent deletion is scheduled';

-- Index for finding soft-deleted businesses
CREATE INDEX IF NOT EXISTS idx_businesses_deleted_at ON businesses(deleted_at)
    WHERE deleted_at IS NOT NULL;

-- ============================================
-- Function to Cascade Delete Business Data
-- Called by Inngest after grace period expires
-- ============================================
CREATE OR REPLACE FUNCTION delete_business_data(p_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Delete in order to respect foreign key constraints
    -- (CASCADE should handle most, but being explicit)

    -- Delete SMS messages
    DELETE FROM sms_messages WHERE business_id = p_business_id;

    -- Delete appointments
    DELETE FROM appointments WHERE business_id = p_business_id;

    -- Delete calls
    DELETE FROM calls WHERE business_id = p_business_id;

    -- Delete phone numbers
    DELETE FROM phone_numbers WHERE business_id = p_business_id;

    -- Delete availability slots
    DELETE FROM availability_slots WHERE business_id = p_business_id;

    -- Delete calendar integrations
    DELETE FROM calendar_integrations WHERE business_id = p_business_id;

    -- Delete call settings
    DELETE FROM call_settings WHERE business_id = p_business_id;

    -- Delete AI config
    DELETE FROM ai_config WHERE business_id = p_business_id;

    -- Delete knowledge
    DELETE FROM knowledge WHERE business_id = p_business_id;

    -- Delete FAQs
    DELETE FROM faqs WHERE business_id = p_business_id;

    -- Delete services
    DELETE FROM services WHERE business_id = p_business_id;

    -- Delete business hours
    DELETE FROM business_hours WHERE business_id = p_business_id;

    -- Delete notification settings
    DELETE FROM notification_settings WHERE business_id = p_business_id;

    -- Delete prompt regeneration queue entries
    DELETE FROM prompt_regeneration_queue WHERE business_id = p_business_id;

    -- Delete data requests
    DELETE FROM data_requests WHERE business_id = p_business_id;

    -- Delete upsells if table exists
    DELETE FROM upsells WHERE business_id = p_business_id;

    -- Delete bundles if table exists (will cascade to bundle_services)
    DELETE FROM bundles WHERE business_id = p_business_id;

    -- Delete packages if table exists
    DELETE FROM packages WHERE business_id = p_business_id;

    -- Delete memberships if table exists
    DELETE FROM memberships WHERE business_id = p_business_id;

    -- Finally delete the business
    DELETE FROM businesses WHERE id = p_business_id;

    -- Note: The user record in auth.users is handled separately via Supabase Admin API
END;
$$;

COMMENT ON FUNCTION delete_business_data IS 'Permanently deletes all business data after GDPR grace period';

-- ============================================
-- Function to Get Export Data
-- Returns all user data as JSONB for export
-- ============================================
CREATE OR REPLACE FUNCTION get_business_export_data(p_business_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'exported_at', NOW(),
        'business', (
            SELECT row_to_json(b.*)
            FROM businesses b
            WHERE b.id = p_business_id
        ),
        'business_hours', (
            SELECT COALESCE(jsonb_agg(row_to_json(bh.*)), '[]'::jsonb)
            FROM business_hours bh
            WHERE bh.business_id = p_business_id
        ),
        'services', (
            SELECT COALESCE(jsonb_agg(row_to_json(s.*)), '[]'::jsonb)
            FROM services s
            WHERE s.business_id = p_business_id
        ),
        'faqs', (
            SELECT COALESCE(jsonb_agg(row_to_json(f.*)), '[]'::jsonb)
            FROM faqs f
            WHERE f.business_id = p_business_id
        ),
        'knowledge', (
            SELECT row_to_json(k.*)
            FROM knowledge k
            WHERE k.business_id = p_business_id
        ),
        'ai_config', (
            SELECT row_to_json(ac.*)
            FROM ai_config ac
            WHERE ac.business_id = p_business_id
        ),
        'call_settings', (
            SELECT row_to_json(cs.*)
            FROM call_settings cs
            WHERE cs.business_id = p_business_id
        ),
        'calendar_integration', (
            SELECT row_to_json(ci.*)
            FROM calendar_integrations ci
            WHERE ci.business_id = p_business_id
        ),
        'availability_slots', (
            SELECT COALESCE(jsonb_agg(row_to_json(avs.*)), '[]'::jsonb)
            FROM availability_slots avs
            WHERE avs.business_id = p_business_id
        ),
        'phone_numbers', (
            SELECT COALESCE(jsonb_agg(row_to_json(pn.*)), '[]'::jsonb)
            FROM phone_numbers pn
            WHERE pn.business_id = p_business_id
        ),
        'calls', (
            SELECT COALESCE(jsonb_agg(row_to_json(c.*)), '[]'::jsonb)
            FROM calls c
            WHERE c.business_id = p_business_id
        ),
        'appointments', (
            SELECT COALESCE(jsonb_agg(row_to_json(a.*)), '[]'::jsonb)
            FROM appointments a
            WHERE a.business_id = p_business_id
        ),
        'sms_messages', (
            SELECT COALESCE(jsonb_agg(row_to_json(sm.*)), '[]'::jsonb)
            FROM sms_messages sm
            WHERE sm.business_id = p_business_id
        ),
        'notification_settings', (
            SELECT row_to_json(ns.*)
            FROM notification_settings ns
            WHERE ns.business_id = p_business_id
        )
    ) INTO result;

    RETURN result;
END;
$$;

COMMENT ON FUNCTION get_business_export_data IS 'Exports all business data as JSON for GDPR data portability';
