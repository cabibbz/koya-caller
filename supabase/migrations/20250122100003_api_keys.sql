-- Migration: API Keys System for Zapier Integration
-- Enables external integrations via API key authentication
-- Supports Zapier app registration and webhook triggers/actions

-- ============================================
-- API Keys Table
-- Stores API key configurations for businesses
-- ============================================
CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  is_active boolean DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Validate key prefix format
  CONSTRAINT valid_key_prefix CHECK (key_prefix ~ '^koya_(live|test)_[a-zA-Z0-9]{8}$'),
  -- Ensure at least one permission is granted
  CONSTRAINT at_least_one_permission CHECK (array_length(permissions, 1) > 0)
);

COMMENT ON TABLE api_keys IS 'API keys for external integrations like Zapier';
COMMENT ON COLUMN api_keys.key_hash IS 'SHA-256 hash of the full API key for verification';
COMMENT ON COLUMN api_keys.key_prefix IS 'First part of the key (koya_live_xxxxxxxx) for display purposes';
COMMENT ON COLUMN api_keys.permissions IS 'Array of permissions: read:calls, write:appointments, read:appointments, webhooks:manage';
COMMENT ON COLUMN api_keys.last_used_at IS 'Timestamp of last API request using this key';
COMMENT ON COLUMN api_keys.expires_at IS 'Optional expiration date for the key';

-- Indexes for efficient queries
CREATE INDEX idx_api_keys_business_id ON api_keys(business_id);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active) WHERE is_active = true;

-- ============================================
-- Webhook Subscriptions Table (Zapier-specific)
-- Stores Zapier's subscription URLs for triggers
-- ============================================
CREATE TABLE zapier_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  target_url text NOT NULL,
  event_type text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Validate URL format
  CONSTRAINT valid_target_url CHECK (target_url ~ '^https://'),
  -- Validate event type
  CONSTRAINT valid_event_type CHECK (event_type IN ('call.ended', 'call.missed', 'appointment.created'))
);

COMMENT ON TABLE zapier_subscriptions IS 'Zapier webhook subscriptions for triggers';
COMMENT ON COLUMN zapier_subscriptions.target_url IS 'Zapier subscription URL to receive webhook payloads';
COMMENT ON COLUMN zapier_subscriptions.event_type IS 'Event type: call.ended, call.missed, appointment.created';

-- Indexes for efficient queries
CREATE INDEX idx_zapier_subscriptions_business_id ON zapier_subscriptions(business_id);
CREATE INDEX idx_zapier_subscriptions_event_type ON zapier_subscriptions(event_type);
CREATE INDEX idx_zapier_subscriptions_api_key_id ON zapier_subscriptions(api_key_id);
CREATE INDEX idx_zapier_subscriptions_active ON zapier_subscriptions(is_active) WHERE is_active = true;

-- ============================================
-- API Key Usage Log Table
-- Tracks API key usage for security auditing
-- ============================================
CREATE TABLE api_key_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code int NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT valid_method CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE'))
);

COMMENT ON TABLE api_key_usage_log IS 'Audit log for API key usage';

-- Index for querying by key and time
CREATE INDEX idx_api_key_usage_log_key_id ON api_key_usage_log(api_key_id);
CREATE INDEX idx_api_key_usage_log_created_at ON api_key_usage_log(created_at);

-- Cleanup old log entries (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_api_key_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM api_key_usage_log
  WHERE created_at < now() - interval '30 days';
END;
$$;

-- ============================================
-- Updated At Triggers
-- ============================================
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_zapier_subscriptions_updated_at
  BEFORE UPDATE ON zapier_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE zapier_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage_log ENABLE ROW LEVEL SECURITY;

-- API keys policies
CREATE POLICY "Users can view own business API keys" ON api_keys
  FOR SELECT USING (business_id = public.tenant_id());
CREATE POLICY "Users can insert own business API keys" ON api_keys
  FOR INSERT WITH CHECK (business_id = public.tenant_id());
CREATE POLICY "Users can update own business API keys" ON api_keys
  FOR UPDATE USING (business_id = public.tenant_id());
CREATE POLICY "Users can delete own business API keys" ON api_keys
  FOR DELETE USING (business_id = public.tenant_id());

-- Zapier subscriptions policies
CREATE POLICY "Users can view own business subscriptions" ON zapier_subscriptions
  FOR SELECT USING (business_id = public.tenant_id());
CREATE POLICY "Users can insert own business subscriptions" ON zapier_subscriptions
  FOR INSERT WITH CHECK (business_id = public.tenant_id());
CREATE POLICY "Users can update own business subscriptions" ON zapier_subscriptions
  FOR UPDATE USING (business_id = public.tenant_id());
CREATE POLICY "Users can delete own business subscriptions" ON zapier_subscriptions
  FOR DELETE USING (business_id = public.tenant_id());

-- Usage log policies (read-only for users)
CREATE POLICY "Users can view own business usage logs" ON api_key_usage_log
  FOR SELECT USING (
    api_key_id IN (
      SELECT id FROM api_keys WHERE business_id = public.tenant_id()
    )
  );

-- Service role bypass for API operations
CREATE POLICY "Service role bypass api_keys" ON api_keys
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass zapier_subscriptions" ON zapier_subscriptions
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass api_key_usage_log" ON api_key_usage_log
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Helper function to verify API key
-- ============================================
CREATE OR REPLACE FUNCTION verify_api_key(key_to_verify text)
RETURNS TABLE (
  api_key_id uuid,
  business_id uuid,
  permissions text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  key_hash_to_check text;
  prefix text;
BEGIN
  -- Extract prefix from the key
  prefix := substring(key_to_verify from 1 for 19);

  -- Hash the full key
  key_hash_to_check := encode(sha256(key_to_verify::bytea), 'hex');

  -- Look up the key
  RETURN QUERY
  SELECT ak.id, ak.business_id, ak.permissions
  FROM api_keys ak
  WHERE ak.key_prefix = prefix
    AND ak.key_hash = key_hash_to_check
    AND ak.is_active = true
    AND (ak.expires_at IS NULL OR ak.expires_at > now());
END;
$$;

COMMENT ON FUNCTION verify_api_key IS 'Verifies an API key and returns associated business info if valid';
