-- Auth Events - Security Logging for Failed Authentication Detection
-- Tracks login attempts for brute force detection and security auditing

CREATE TABLE IF NOT EXISTS auth_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'login_success', 'login_failed', 'lockout'
    ip_address TEXT,
    user_agent TEXT,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient lookups by email and time (for counting recent failures)
CREATE INDEX idx_auth_events_email_time ON auth_events(email, created_at DESC);

-- Index for admin queries to view recent events
CREATE INDEX idx_auth_events_created_at ON auth_events(created_at DESC);

-- Index for filtering by event type
CREATE INDEX idx_auth_events_type ON auth_events(event_type);

-- Add comments explaining the table
COMMENT ON TABLE auth_events IS 'Tracks authentication events for security logging and brute force detection';
COMMENT ON COLUMN auth_events.email IS 'The email address used in the login attempt';
COMMENT ON COLUMN auth_events.event_type IS 'Type of event: login_success, login_failed, lockout';
COMMENT ON COLUMN auth_events.ip_address IS 'IP address from x-forwarded-for or x-real-ip headers';
COMMENT ON COLUMN auth_events.user_agent IS 'User agent string from request headers';
COMMENT ON COLUMN auth_events.failure_reason IS 'Reason for failure (e.g., invalid_password, account_locked, user_not_found)';

-- Enable RLS (admin/service role only access)
ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access auth events (security sensitive data)
CREATE POLICY "Service role can manage auth_events" ON auth_events
  FOR ALL USING (auth.role() = 'service_role');

-- Admin users can view auth events (for admin dashboard)
CREATE POLICY "Admin can view auth_events" ON auth_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  );

-- Function to count recent failures for an email (used for lockout detection)
CREATE OR REPLACE FUNCTION count_recent_auth_failures(
    p_email TEXT,
    p_minutes INTEGER DEFAULT 15
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    failure_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO failure_count
    FROM auth_events
    WHERE email = LOWER(p_email)
      AND event_type = 'login_failed'
      AND created_at > NOW() - (p_minutes || ' minutes')::INTERVAL;

    RETURN failure_count;
END;
$$;

-- Function to check if account is locked (10+ failures in 15 minutes)
CREATE OR REPLACE FUNCTION is_account_locked(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN count_recent_auth_failures(p_email, 15) >= 10;
END;
$$;

-- Grant execute permissions to authenticated users for lockout check
GRANT EXECUTE ON FUNCTION count_recent_auth_failures TO authenticated;
GRANT EXECUTE ON FUNCTION is_account_locked TO authenticated;
GRANT EXECUTE ON FUNCTION count_recent_auth_failures TO anon;
GRANT EXECUTE ON FUNCTION is_account_locked TO anon;
