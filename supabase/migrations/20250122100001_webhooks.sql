-- Migration: Webhooks System
-- Generic webhook delivery system for external integrations
-- Supports multiple webhook URLs, event filtering, and retry logic

-- Ensure tenant_id function exists (may be missing from remote)
CREATE OR REPLACE FUNCTION public.tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid,
    null
  )
$$;

-- Ensure update_updated_at_column function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old webhook_deliveries if it exists (from add_business_webhooks.sql)
-- It references business_webhooks but we need it to reference webhooks
DROP TABLE IF EXISTS webhook_deliveries CASCADE;

-- ============================================
-- Webhooks Table
-- Stores webhook configurations for businesses
-- ============================================
CREATE TABLE IF NOT EXISTS webhooks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  url text not null,
  events text[] not null default '{}',
  secret text not null,
  is_active boolean default true,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Validate URL format
  constraint webhooks_valid_url check (url ~ '^https?://'),
  -- Ensure at least one event is configured
  constraint webhooks_at_least_one_event check (array_length(events, 1) > 0)
);

comment on table webhooks is 'Webhook configurations for external integrations';
comment on column webhooks.url is 'HTTPS endpoint to receive webhook payloads';
comment on column webhooks.events is 'Array of event types to send: call.started, call.ended, appointment.created, etc.';
comment on column webhooks.secret is 'HMAC secret for signature verification';
comment on column webhooks.is_active is 'Whether this webhook is currently enabled';

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_webhooks_business_id on webhooks(business_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_is_active on webhooks(is_active) where is_active = true;

-- ============================================
-- Webhook Deliveries Table
-- Tracks all webhook delivery attempts
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid references webhooks(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  response_code int,
  response_body text,
  attempts int default 1,
  max_attempts int default 5,
  last_attempt_at timestamptz default now(),
  next_retry_at timestamptz,
  status text default 'pending',
  error_message text,
  created_at timestamptz default now(),

  constraint webhook_deliveries_valid_status check (status in ('pending', 'success', 'failed', 'retrying'))
);

comment on table webhook_deliveries is 'Tracks webhook delivery attempts and status';
comment on column webhook_deliveries.attempts is 'Number of delivery attempts made';
comment on column webhook_deliveries.next_retry_at is 'When to retry failed delivery (exponential backoff)';
comment on column webhook_deliveries.status is 'pending, success, failed, or retrying';

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id on webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status on webhook_deliveries(status) where status != 'success';
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry on webhook_deliveries(next_retry_at) where status = 'retrying';
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at on webhook_deliveries(created_at);

-- ============================================
-- Updated At Trigger
-- ============================================
DROP TRIGGER IF EXISTS update_webhooks_updated_at ON webhooks;
CREATE TRIGGER update_webhooks_updated_at
  before update on webhooks
  for each row
  execute function update_updated_at_column();

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own business webhooks" ON webhooks;
DROP POLICY IF EXISTS "Users can insert own business webhooks" ON webhooks;
DROP POLICY IF EXISTS "Users can update own business webhooks" ON webhooks;
DROP POLICY IF EXISTS "Users can delete own business webhooks" ON webhooks;
DROP POLICY IF EXISTS "Users can view own business webhook deliveries" ON webhook_deliveries;
DROP POLICY IF EXISTS "Service role bypass webhooks" ON webhooks;
DROP POLICY IF EXISTS "Service role bypass webhook_deliveries" ON webhook_deliveries;

-- Webhooks policies
CREATE POLICY "Users can view own business webhooks" ON webhooks
  FOR SELECT USING (business_id = public.tenant_id());
CREATE POLICY "Users can insert own business webhooks" ON webhooks
  FOR INSERT WITH CHECK (business_id = public.tenant_id());
CREATE POLICY "Users can update own business webhooks" ON webhooks
  FOR UPDATE USING (business_id = public.tenant_id());
CREATE POLICY "Users can delete own business webhooks" ON webhooks
  FOR DELETE USING (business_id = public.tenant_id());

-- Webhook deliveries policies
CREATE POLICY "Users can view own business webhook deliveries" ON webhook_deliveries
  FOR SELECT USING (
    webhook_id in (
      select id from webhooks where business_id = public.tenant_id()
    )
  );

-- Service role bypass for background job processing
CREATE POLICY "Service role bypass webhooks" ON webhooks
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass webhook_deliveries" ON webhook_deliveries
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Helper function to calculate next retry time
-- Uses exponential backoff: 1s, 4s, 16s, 64s, 256s
-- ============================================
CREATE OR REPLACE FUNCTION calculate_webhook_retry_delay(attempt_count int)
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$
  -- Exponential backoff: 4^(attempt-1) seconds
  -- Attempt 1: 1s, 2: 4s, 3: 16s, 4: 64s, 5: 256s
  select (power(4, least(attempt_count - 1, 4)))::int * interval '1 second'
$$;

COMMENT ON FUNCTION calculate_webhook_retry_delay IS 'Calculates exponential backoff delay for webhook retries';
