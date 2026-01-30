-- Demo Leads and Rate Limiting
-- Spec Reference: Part 3, Lines 132-158 (Demo Koya)
-- Spec Reference: Part 20, Line 2141 (3 requests per 1 hour per IP)

-- Table: demo_leads
-- Captures emails from users who try the demo
CREATE TABLE IF NOT EXISTS demo_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address TEXT,
    language TEXT DEFAULT 'en',
    call_completed BOOLEAN DEFAULT FALSE,
    call_duration_seconds INTEGER,
    converted_to_signup BOOLEAN DEFAULT FALSE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for email lookup
CREATE INDEX IF NOT EXISTS idx_demo_leads_email ON demo_leads(email);
CREATE INDEX IF NOT EXISTS idx_demo_leads_ip ON demo_leads(ip_address);
CREATE INDEX IF NOT EXISTS idx_demo_leads_created ON demo_leads(created_at);

-- Table: demo_rate_limits
-- Track demo call attempts per IP for rate limiting
CREATE TABLE IF NOT EXISTS demo_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    call_count INTEGER DEFAULT 0,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for IP lookup
CREATE INDEX IF NOT EXISTS idx_demo_rate_limits_ip ON demo_rate_limits(ip_address);
CREATE INDEX IF NOT EXISTS idx_demo_rate_limits_window ON demo_rate_limits(window_start);

-- Function to check rate limit
-- Returns TRUE if the request is allowed, FALSE if rate limited
CREATE OR REPLACE FUNCTION check_demo_rate_limit(p_ip_address TEXT, p_max_calls INTEGER DEFAULT 3, p_window_minutes INTEGER DEFAULT 60)
RETURNS BOOLEAN AS $$
DECLARE
    v_record demo_rate_limits%ROWTYPE;
    v_window_start TIMESTAMPTZ;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    v_window_start := v_now - (p_window_minutes || ' minutes')::INTERVAL;

    -- Get existing rate limit record
    SELECT * INTO v_record
    FROM demo_rate_limits
    WHERE ip_address = p_ip_address
    ORDER BY window_start DESC
    LIMIT 1;

    -- If no record exists or window expired, create/reset
    IF v_record IS NULL OR v_record.window_start < v_window_start THEN
        INSERT INTO demo_rate_limits (ip_address, call_count, window_start)
        VALUES (p_ip_address, 1, v_now)
        ON CONFLICT (id) DO NOTHING;
        RETURN TRUE;
    END IF;

    -- Check if under limit
    IF v_record.call_count < p_max_calls THEN
        UPDATE demo_rate_limits
        SET call_count = call_count + 1, updated_at = v_now
        WHERE id = v_record.id;
        RETURN TRUE;
    END IF;

    -- Rate limited
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to record a demo lead
CREATE OR REPLACE FUNCTION record_demo_lead(
    p_email TEXT,
    p_ip_address TEXT DEFAULT NULL,
    p_language TEXT DEFAULT 'en'
)
RETURNS UUID AS $$
DECLARE
    v_lead_id UUID;
BEGIN
    INSERT INTO demo_leads (email, ip_address, language)
    VALUES (p_email, p_ip_address, p_language)
    RETURNING id INTO v_lead_id;

    RETURN v_lead_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update demo lead after call
CREATE OR REPLACE FUNCTION update_demo_lead_call(
    p_lead_id UUID,
    p_completed BOOLEAN,
    p_duration_seconds INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE demo_leads
    SET
        call_completed = p_completed,
        call_duration_seconds = p_duration_seconds,
        updated_at = NOW()
    WHERE id = p_lead_id;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE demo_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access demo tables (API routes use service role)
CREATE POLICY "Service role can manage demo_leads" ON demo_leads
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage demo_rate_limits" ON demo_rate_limits
    FOR ALL USING (auth.role() = 'service_role');

-- Admin can read demo leads
CREATE POLICY "Admins can read demo_leads" ON demo_leads
    FOR SELECT USING (
        auth.uid() IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
            AND raw_app_meta_data->>'is_admin' = 'true'
        )
    );
