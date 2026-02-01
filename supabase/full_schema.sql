-- =============================================================================
-- KOYA CALLER - COMPLETE DATABASE SCHEMA
-- Generated: 2026-01-12
--
-- This is an idempotent schema file that can be run against a fresh database.
-- Tables are ordered by dependency (no forward references).
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- SECTION 1: HELPER FUNCTIONS
-- =============================================================================

-- Tenant ID extraction from JWT for RLS
CREATE OR REPLACE FUNCTION public.tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid,
    NULL
  )
$$;

-- Admin check function
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_status BOOLEAN;
BEGIN
  SELECT (raw_app_meta_data->>'is_admin')::boolean INTO admin_status
  FROM auth.users
  WHERE id = auth.uid();
  RETURN COALESCE(admin_status, FALSE);
END;
$$;

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SECTION 2: CORE TABLES (No dependencies)
-- =============================================================================

-- Users (business owners)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  phone text,
  created_at timestamptz DEFAULT NOW()
);
COMMENT ON TABLE users IS 'Business owners who use Koya Caller';

-- Plans (pricing tiers)
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  price_cents int NOT NULL,
  included_minutes int NOT NULL,
  features jsonb,
  stripe_price_id text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true
);
COMMENT ON TABLE plans IS 'Pricing plans: Starter, Professional, Business';

-- Business templates (industry presets)
CREATE TABLE IF NOT EXISTS business_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  type_slug text UNIQUE NOT NULL,
  type_name text NOT NULL,
  default_services jsonb,
  default_faqs jsonb,
  urgency_triggers text[],
  sort_order int DEFAULT 0
);
COMMENT ON TABLE business_templates IS 'Industry templates for onboarding';

-- Site settings (global config)
CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT NOW(),
  updated_by uuid
);
COMMENT ON TABLE site_settings IS 'Global site configuration';

-- =============================================================================
-- SECTION 3: BUSINESS TABLES (Depend on users, plans)
-- =============================================================================

-- Businesses (main entity)
CREATE TABLE IF NOT EXISTS businesses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  business_type text,
  industry text,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  website text,
  description text,
  service_area text,
  differentiator text,
  timezone text DEFAULT 'America/New_York',

  -- Onboarding
  onboarding_step int DEFAULT 1,
  onboarding_completed_at timestamptz,

  -- Subscription
  subscription_status text DEFAULT 'onboarding',
  plan_id uuid REFERENCES plans(id),
  stripe_customer_id text,
  stripe_subscription_id text,

  -- Usage tracking
  current_cycle_start date,
  current_cycle_end date,
  minutes_used_this_cycle int DEFAULT 0,
  minutes_included int DEFAULT 0,
  last_usage_alert_percent int DEFAULT 0,

  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);
COMMENT ON TABLE businesses IS 'Business profiles with subscription and usage tracking';
COMMENT ON COLUMN businesses.industry IS 'Business industry/type used for AI prompt customization';

CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_subscription_status ON businesses(subscription_status);
CREATE INDEX IF NOT EXISTS idx_businesses_plan_id ON businesses(plan_id);

-- Business hours (7 rows per business)
CREATE TABLE IF NOT EXISTS business_hours (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  day_of_week int NOT NULL,
  open_time time,
  close_time time,
  is_closed boolean DEFAULT false,

  CONSTRAINT unique_business_day UNIQUE (business_id, day_of_week),
  CONSTRAINT valid_day_of_week CHECK (day_of_week >= 0 AND day_of_week <= 6)
);
COMMENT ON TABLE business_hours IS 'Operating hours for each day of the week';
CREATE INDEX IF NOT EXISTS idx_business_hours_business_id ON business_hours(business_id);

-- =============================================================================
-- SECTION 4: BUSINESS CONFIGURATION TABLES
-- =============================================================================

-- Services
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_minutes int DEFAULT 60,
  price_cents int,
  price_type text DEFAULT 'fixed',
  is_bookable boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),

  CONSTRAINT valid_price_type CHECK (price_type IN ('fixed', 'quote', 'hidden'))
);
COMMENT ON TABLE services IS 'Services offered by the business';
CREATE INDEX IF NOT EXISTS idx_services_business_id ON services(business_id);

-- FAQs
CREATE TABLE IF NOT EXISTS faqs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  question text NOT NULL,
  answer text NOT NULL,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);
COMMENT ON TABLE faqs IS 'Frequently asked questions for each business';
CREATE INDEX IF NOT EXISTS idx_faqs_business_id ON faqs(business_id);

-- Knowledge (additional context)
CREATE TABLE IF NOT EXISTS knowledge (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  content text,
  never_say text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);
COMMENT ON TABLE knowledge IS 'Additional business context and restrictions';

-- AI Configuration
CREATE TABLE IF NOT EXISTS ai_config (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,

  -- Voice settings
  voice_id text,
  voice_id_spanish text,
  language text DEFAULT 'en-US',

  -- Personality
  ai_name text DEFAULT 'Koya',
  personality text DEFAULT 'professional',

  -- Greetings
  greeting text,
  after_hours_greeting text,
  minutes_exhausted_greeting text,
  greeting_spanish text,
  after_hours_greeting_spanish text,
  minutes_exhausted_greeting_spanish text,

  -- Language settings
  spanish_enabled boolean DEFAULT false,
  language_mode text DEFAULT 'auto',

  -- System prompt
  system_prompt text,
  system_prompt_spanish text,
  system_prompt_version int DEFAULT 1,
  system_prompt_generated_at timestamptz,

  -- Retell integration
  retell_agent_id text,
  retell_agent_id_spanish text,
  retell_agent_version int DEFAULT 1,
  retell_synced_at timestamptz,

  -- Feature toggles
  upsells_enabled boolean DEFAULT true,
  bundles_enabled boolean DEFAULT true,
  packages_enabled boolean DEFAULT true,
  memberships_enabled boolean DEFAULT true,

  -- Enhanced prompt config
  prompt_config jsonb DEFAULT '{
    "industryEnhancements": true,
    "fewShotExamplesEnabled": true,
    "sentimentDetectionLevel": "basic",
    "callerContextEnabled": true,
    "toneIntensity": 3,
    "personalityAwareErrors": true,
    "maxFewShotExamples": 3
  }'::jsonb,

  -- Retell advanced features
  boosted_keywords text[] DEFAULT '{}',
  analysis_summary_prompt text,
  analysis_model text DEFAULT 'gpt-4.1-mini',
  fallback_voice_ids text[] DEFAULT '{}',

  -- Voice control settings
  voice_temperature numeric(3,2) DEFAULT 1.0,
  voice_speed numeric(3,2) DEFAULT 1.0,
  voice_volume numeric(3,2) DEFAULT 1.0,
  begin_message_delay_ms integer DEFAULT 0,

  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),

  CONSTRAINT valid_language_mode CHECK (language_mode IN ('auto', 'ask', 'spanish_default')),
  CONSTRAINT valid_personality CHECK (personality IN ('professional', 'friendly', 'casual')),
  CONSTRAINT valid_analysis_model CHECK (analysis_model IN ('gpt-4.1-mini', 'claude-4.5-sonnet', 'gemini-2.5-flash')),
  CONSTRAINT valid_voice_temperature CHECK (voice_temperature >= 0 AND voice_temperature <= 2),
  CONSTRAINT valid_voice_speed CHECK (voice_speed >= 0.5 AND voice_speed <= 2),
  CONSTRAINT valid_voice_volume CHECK (voice_volume >= 0 AND voice_volume <= 2),
  CONSTRAINT valid_begin_message_delay CHECK (begin_message_delay_ms >= 0 AND begin_message_delay_ms <= 5000)
);
COMMENT ON TABLE ai_config IS 'AI voice and personality configuration';

-- Call Settings
CREATE TABLE IF NOT EXISTS call_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,

  -- Transfer settings
  transfer_number text,
  backup_transfer_number text,
  transfer_on_request boolean DEFAULT true,
  transfer_on_emergency boolean DEFAULT true,
  transfer_on_upset boolean DEFAULT false,
  transfer_keywords text[] DEFAULT '{}',
  transfer_hours_type text DEFAULT 'always',
  transfer_hours_custom jsonb,

  -- No answer handling
  no_answer_action text DEFAULT 'message',
  no_answer_timeout_seconds int DEFAULT 30,

  -- After hours
  after_hours_enabled boolean DEFAULT true,
  after_hours_can_book boolean DEFAULT true,
  after_hours_message_only boolean DEFAULT false,
  after_hours_action text DEFAULT 'ai',

  -- Call limits
  max_call_duration_seconds int DEFAULT 600,
  recording_enabled boolean DEFAULT true,

  -- Voicemail Detection
  voicemail_detection_enabled boolean DEFAULT false,
  voicemail_message text,
  voicemail_detection_timeout_ms integer DEFAULT 30000,

  -- Silence Handling
  reminder_trigger_ms integer DEFAULT 10000,
  reminder_max_count integer DEFAULT 2,
  end_call_after_silence_ms integer DEFAULT 30000,

  -- DTMF Input
  dtmf_enabled boolean DEFAULT false,
  dtmf_digit_limit integer DEFAULT 10,
  dtmf_termination_key text DEFAULT '#',
  dtmf_timeout_ms integer DEFAULT 5000,

  -- Denoising
  denoising_mode text DEFAULT 'noise-cancellation',

  -- PII Redaction
  pii_redaction_enabled boolean DEFAULT false,
  pii_categories text[] DEFAULT ARRAY['ssn', 'credit_card']::text[],

  -- Responsiveness Settings (how quickly and sensitively to respond)
  interruption_sensitivity numeric(3,2) DEFAULT 0.9,
  responsiveness numeric(3,2) DEFAULT 0.9,

  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),

  CONSTRAINT valid_transfer_hours_type CHECK (transfer_hours_type IN ('always', 'business_hours', 'custom')),
  CONSTRAINT valid_denoising_mode CHECK (denoising_mode IN ('noise-cancellation', 'noise-and-background-speech-cancellation')),
  CONSTRAINT valid_dtmf_termination_key CHECK (dtmf_termination_key IN ('#', '*', 'none')),
  CONSTRAINT valid_voicemail_timeout CHECK (voicemail_detection_timeout_ms >= 5000 AND voicemail_detection_timeout_ms <= 180000),
  CONSTRAINT valid_reminder_trigger CHECK (reminder_trigger_ms >= 5000 AND reminder_trigger_ms <= 60000),
  CONSTRAINT valid_end_call_silence CHECK (end_call_after_silence_ms >= 10000 AND end_call_after_silence_ms <= 120000),
  CONSTRAINT valid_dtmf_timeout CHECK (dtmf_timeout_ms >= 1000 AND dtmf_timeout_ms <= 15000),
  CONSTRAINT valid_dtmf_digit_limit CHECK (dtmf_digit_limit >= 1 AND dtmf_digit_limit <= 50),
  CONSTRAINT valid_reminder_max_count CHECK (reminder_max_count >= 0 AND reminder_max_count <= 10),
  CONSTRAINT valid_interruption_sensitivity CHECK (interruption_sensitivity >= 0 AND interruption_sensitivity <= 1),
  CONSTRAINT valid_responsiveness CHECK (responsiveness >= 0 AND responsiveness <= 1)
);
COMMENT ON TABLE call_settings IS 'Call handling configuration';
COMMENT ON COLUMN call_settings.after_hours_action IS 'Action to take for after-hours calls: voicemail, ai, or transfer';
COMMENT ON COLUMN call_settings.interruption_sensitivity IS 'How sensitive to caller interruptions (0-1). Higher = stops faster when caller speaks.';
COMMENT ON COLUMN call_settings.responsiveness IS 'How quickly to respond after caller stops speaking (0-1). Higher = responds faster.';

-- Notification Settings
CREATE TABLE IF NOT EXISTS notification_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,

  -- Owner SMS
  sms_all_calls boolean DEFAULT false,
  sms_bookings boolean DEFAULT true,
  sms_missed boolean DEFAULT true,
  sms_messages boolean DEFAULT true,
  sms_usage_alerts boolean DEFAULT true,

  -- Owner email
  email_daily boolean DEFAULT false,
  email_weekly boolean DEFAULT true,
  email_missed boolean DEFAULT true,

  -- Customer notifications
  sms_customer_confirmation boolean DEFAULT true,
  sms_customer_reminder text DEFAULT '24hr',

  CONSTRAINT valid_reminder CHECK (sms_customer_reminder IN ('off', '1hr', '24hr', 'both'))
);
COMMENT ON TABLE notification_settings IS 'Notification preferences';

-- SMS Templates
CREATE TABLE IF NOT EXISTS sms_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,

  -- Customer-facing templates
  booking_confirmation text,
  reminder_24hr text,
  reminder_1hr text,

  -- Owner-facing templates
  missed_call_alert text,
  message_alert text,
  transfer_alert text,

  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);
COMMENT ON TABLE sms_templates IS 'Customizable SMS notification templates';
COMMENT ON COLUMN sms_templates.booking_confirmation IS 'Variables: {{business_name}}, {{service_name}}, {{date_time}}, {{customer_name}}';
COMMENT ON COLUMN sms_templates.reminder_24hr IS 'Variables: {{business_name}}, {{service_name}}, {{date_time}}, {{customer_name}}';
COMMENT ON COLUMN sms_templates.reminder_1hr IS 'Variables: {{business_name}}, {{service_name}}, {{date_time}}, {{customer_name}}';
COMMENT ON COLUMN sms_templates.missed_call_alert IS 'Variables: {{caller_name}}, {{caller_phone}}, {{call_time}}';
COMMENT ON COLUMN sms_templates.message_alert IS 'Variables: {{caller_name}}, {{caller_phone}}, {{message}}';
COMMENT ON COLUMN sms_templates.transfer_alert IS 'Variables: {{caller_name}}, {{caller_phone}}, {{reason}}';

-- =============================================================================
-- SECTION 5: PHONE & CALENDAR INTEGRATION
-- =============================================================================

-- Phone Numbers
CREATE TABLE IF NOT EXISTS phone_numbers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  number text NOT NULL,
  twilio_sid text,
  setup_type text DEFAULT 'direct',
  forwarded_from text,
  carrier text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW(),

  CONSTRAINT valid_setup_type CHECK (setup_type IN ('direct', 'forwarded'))
);
COMMENT ON TABLE phone_numbers IS 'Twilio phone numbers assigned to businesses';
CREATE INDEX IF NOT EXISTS idx_phone_numbers_business_id ON phone_numbers(business_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_number ON phone_numbers(number);

-- Calendar Integrations
CREATE TABLE IF NOT EXISTS calendar_integrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE UNIQUE,
  provider text NOT NULL DEFAULT 'built_in',

  -- OAuth tokens
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  calendar_id text,

  -- Booking settings
  default_duration_minutes int DEFAULT 60,
  buffer_minutes int DEFAULT 0,
  advance_booking_days int DEFAULT 14,
  require_email boolean DEFAULT false,

  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),

  CONSTRAINT valid_provider CHECK (provider IN ('google', 'outlook', 'built_in'))
);
COMMENT ON TABLE calendar_integrations IS 'Calendar provider integration';

-- Availability Slots
CREATE TABLE IF NOT EXISTS availability_slots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  day_of_week int NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,

  CONSTRAINT valid_availability_day CHECK (day_of_week >= 0 AND day_of_week <= 6),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);
COMMENT ON TABLE availability_slots IS 'Available time slots for built-in scheduler';
CREATE INDEX IF NOT EXISTS idx_availability_slots_business_id ON availability_slots(business_id);

-- =============================================================================
-- SECTION 6: CALLS & APPOINTMENTS
-- =============================================================================

-- Calls
CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  retell_call_id text UNIQUE,
  from_number text,
  to_number text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  duration_minutes_billed int,
  language text DEFAULT 'en',
  recording_url text,
  transcript jsonb,
  summary text,
  outcome text,
  lead_info jsonb,
  message_taken text,
  cost_cents int,
  flagged boolean DEFAULT false,
  notes text,

  -- Sentiment tracking
  sentiment_detected text,
  error_recovery_used boolean DEFAULT false,

  created_at timestamptz DEFAULT NOW(),

  CONSTRAINT valid_language CHECK (language IN ('en', 'es')),
  CONSTRAINT valid_outcome CHECK (outcome IS NULL OR outcome IN ('booked', 'transferred', 'info', 'message', 'missed', 'minutes_exhausted'))
);
COMMENT ON TABLE calls IS 'Call records from Retell.ai';
CREATE INDEX IF NOT EXISTS idx_calls_business_id ON calls(business_id);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at);
CREATE INDEX IF NOT EXISTS idx_calls_outcome ON calls(outcome);
CREATE INDEX IF NOT EXISTS idx_calls_retell_call_id ON calls(retell_call_id);
CREATE INDEX IF NOT EXISTS idx_calls_sentiment ON calls(business_id, sentiment_detected) WHERE sentiment_detected IS NOT NULL;

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  call_id uuid REFERENCES calls(id) ON DELETE SET NULL,

  -- Customer info
  customer_name text,
  customer_phone text,
  customer_email text,

  -- Service
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  service_name text,

  -- Scheduling
  scheduled_at timestamptz,
  duration_minutes int,

  -- Status
  status text DEFAULT 'confirmed',
  notes text,
  external_event_id text,

  -- Notifications
  confirmation_sent_at timestamptz,
  reminder_sent_at timestamptz,
  reminder_24hr_sent_at timestamptz,
  reminder_1hr_sent_at timestamptz,

  -- Calendar sync
  calendar_sync_status text DEFAULT 'pending',
  calendar_sync_error text,
  calendar_synced_at timestamptz,

  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show'))
);
COMMENT ON TABLE appointments IS 'Booked appointments';
CREATE INDEX IF NOT EXISTS idx_appointments_business_id ON appointments(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_at ON appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- SMS Messages
CREATE TABLE IF NOT EXISTS sms_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  call_id uuid REFERENCES calls(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  direction text NOT NULL,
  message_type text NOT NULL,
  from_number text,
  to_number text,
  body text,
  twilio_sid text,
  status text DEFAULT 'sent',
  sent_at timestamptz DEFAULT NOW(),

  CONSTRAINT valid_direction CHECK (direction IN ('inbound', 'outbound')),
  CONSTRAINT valid_message_type CHECK (message_type IN ('booking_confirmation', 'reminder', 'message_alert', 'usage_alert', 'transfer_alert')),
  CONSTRAINT valid_sms_status CHECK (status IN ('sent', 'delivered', 'failed'))
);
COMMENT ON TABLE sms_messages IS 'SMS notification records';
CREATE INDEX IF NOT EXISTS idx_sms_messages_business_id ON sms_messages(business_id);

-- Caller Profiles (repeat caller recognition)
CREATE TABLE IF NOT EXISTS caller_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  name text,
  email text,
  preferences jsonb DEFAULT '{}'::jsonb,
  call_count int DEFAULT 1,
  last_call_at timestamptz DEFAULT NOW(),
  last_outcome text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),

  CONSTRAINT unique_business_caller UNIQUE (business_id, phone_number)
);
COMMENT ON TABLE caller_profiles IS 'Caller information for repeat caller recognition';
CREATE INDEX IF NOT EXISTS idx_caller_profiles_lookup ON caller_profiles(business_id, phone_number);

-- =============================================================================
-- SECTION 7: UPSELLING TABLES
-- =============================================================================

-- Upsells (service upgrades)
CREATE TABLE IF NOT EXISTS upsells (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source_service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  target_service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  discount_percent int DEFAULT 0,
  pitch_message text,
  trigger_timing text DEFAULT 'before_booking',
  suggest_when_unavailable boolean DEFAULT false,
  is_active boolean DEFAULT true,
  times_offered int DEFAULT 0,
  times_accepted int DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),

  CONSTRAINT valid_upsell_discount CHECK (discount_percent >= 0 AND discount_percent <= 100),
  CONSTRAINT valid_timing CHECK (trigger_timing IN ('before_booking', 'after_booking')),
  CONSTRAINT different_services CHECK (source_service_id != target_service_id),
  CONSTRAINT unique_upsell_per_service_pair UNIQUE (business_id, source_service_id, target_service_id)
);
COMMENT ON TABLE upsells IS 'Service upgrade offers';
CREATE INDEX IF NOT EXISTS idx_upsells_business_id ON upsells(business_id);
CREATE INDEX IF NOT EXISTS idx_upsells_active ON upsells(business_id, is_active) WHERE is_active = true;

-- Bundles (grouped services)
CREATE TABLE IF NOT EXISTS bundles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  discount_percent int DEFAULT 0,
  pitch_message text,
  is_active boolean DEFAULT true,
  times_offered int DEFAULT 0,
  times_accepted int DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),

  CONSTRAINT valid_bundle_discount CHECK (discount_percent >= 0 AND discount_percent <= 100)
);
COMMENT ON TABLE bundles IS 'Service bundles with combined discount';
CREATE INDEX IF NOT EXISTS idx_bundles_business_id ON bundles(business_id);
CREATE INDEX IF NOT EXISTS idx_bundles_active ON bundles(business_id, is_active) WHERE is_active = true;

-- Bundle Services (junction table)
CREATE TABLE IF NOT EXISTS bundle_services (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  bundle_id uuid NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  sort_order int DEFAULT 0,

  CONSTRAINT unique_bundle_service UNIQUE (bundle_id, service_id)
);
COMMENT ON TABLE bundle_services IS 'Junction table linking bundles to services';
CREATE INDEX IF NOT EXISTS idx_bundle_services_bundle ON bundle_services(bundle_id);

-- Packages (multi-visit)
CREATE TABLE IF NOT EXISTS packages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  session_count int NOT NULL,
  discount_percent int DEFAULT 0,
  price_cents int,
  validity_days int,
  pitch_message text,
  min_visits_to_pitch int DEFAULT 0,
  is_active boolean DEFAULT true,
  times_offered int DEFAULT 0,
  times_accepted int DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),

  CONSTRAINT valid_package_discount CHECK (discount_percent >= 0 AND discount_percent <= 100),
  CONSTRAINT valid_session_count CHECK (session_count >= 2)
);
COMMENT ON TABLE packages IS 'Multi-visit package offers';
CREATE INDEX IF NOT EXISTS idx_packages_business_id ON packages(business_id);
CREATE INDEX IF NOT EXISTS idx_packages_active ON packages(business_id, is_active) WHERE is_active = true;

-- Memberships (recurring)
CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents int NOT NULL,
  billing_period text DEFAULT 'monthly',
  benefits text NOT NULL,
  pitch_message text,
  pitch_after_booking_amount_cents int,
  pitch_after_visit_count int,
  is_active boolean DEFAULT true,
  times_offered int DEFAULT 0,
  times_accepted int DEFAULT 0,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),

  CONSTRAINT valid_membership_price CHECK (price_cents > 0),
  CONSTRAINT valid_billing_period CHECK (billing_period IN ('monthly', 'quarterly', 'annual'))
);
COMMENT ON TABLE memberships IS 'Recurring membership plans';
CREATE INDEX IF NOT EXISTS idx_memberships_business_id ON memberships(business_id);
CREATE INDEX IF NOT EXISTS idx_memberships_active ON memberships(business_id, is_active) WHERE is_active = true;

-- =============================================================================
-- SECTION 8: ADMIN & SYSTEM TABLES
-- =============================================================================

-- Admin Audit Logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id uuid,
  admin_email text,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  previous_value text,
  new_value text,
  ip_address text,
  created_at timestamptz DEFAULT NOW()
);
COMMENT ON TABLE admin_audit_logs IS 'Audit trail for admin actions';
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  content text NOT NULL,
  type text DEFAULT 'info',
  is_active boolean DEFAULT true,
  starts_at timestamptz DEFAULT NOW(),
  ends_at timestamptz,
  created_at timestamptz DEFAULT NOW(),
  created_by uuid
);
COMMENT ON TABLE announcements IS 'System announcements for users';

-- System Logs
CREATE TABLE IF NOT EXISTS system_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  level text NOT NULL,
  category text,
  message text NOT NULL,
  metadata jsonb,
  business_id uuid,
  created_at timestamptz DEFAULT NOW()
);
COMMENT ON TABLE system_logs IS 'Application logs for debugging';
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at);

-- Demo Leads
CREATE TABLE IF NOT EXISTS demo_leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL,
  phone text,
  business_name text,
  demo_started_at timestamptz DEFAULT NOW(),
  demo_completed boolean DEFAULT false,
  converted_to_signup boolean DEFAULT false,
  converted_at timestamptz
);
COMMENT ON TABLE demo_leads IS 'Leads from website demo';
CREATE INDEX IF NOT EXISTS idx_demo_leads_email ON demo_leads(email);

-- Demo Rate Limits
CREATE TABLE IF NOT EXISTS demo_rate_limits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier text NOT NULL,
  call_count int DEFAULT 0,
  window_start timestamptz DEFAULT NOW(),
  CONSTRAINT unique_demo_identifier UNIQUE (identifier)
);

-- Prompt Regeneration Queue
CREATE TABLE IF NOT EXISTS prompt_regeneration_queue (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  triggered_by text NOT NULL,
  status text DEFAULT 'pending',
  error_message text,
  created_at timestamptz DEFAULT NOW(),
  processed_at timestamptz,

  CONSTRAINT valid_triggered_by CHECK (triggered_by IN ('services_update', 'faqs_update', 'knowledge_update', 'settings_update', 'language_update', 'direct')),
  CONSTRAINT valid_queue_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);
COMMENT ON TABLE prompt_regeneration_queue IS 'Queue for async prompt regeneration';
CREATE INDEX IF NOT EXISTS idx_prompt_queue_status ON prompt_regeneration_queue(status);
CREATE INDEX IF NOT EXISTS idx_prompt_queue_business_id ON prompt_regeneration_queue(business_id);

-- =============================================================================
-- SECTION 9: BLOG TABLES
-- =============================================================================

-- Blog Posts
CREATE TABLE IF NOT EXISTS blog_posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  excerpt text,
  meta_description text,
  featured_image text,
  status text DEFAULT 'draft',
  author text DEFAULT 'Koya Team',
  tags text[],
  published_at timestamptz,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),

  CONSTRAINT valid_blog_status CHECK (status IN ('draft', 'published', 'archived'))
);
COMMENT ON TABLE blog_posts IS 'Blog posts for SEO and marketing';
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published_at) WHERE status = 'published';

-- Blog Generation Queue
CREATE TABLE IF NOT EXISTS blog_generation_queue (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic text NOT NULL,
  keywords text[],
  status text DEFAULT 'pending',
  result_post_id uuid REFERENCES blog_posts(id),
  error_message text,
  created_at timestamptz DEFAULT NOW(),
  processed_at timestamptz
);

-- Blog Clusters
CREATE TABLE IF NOT EXISTS blog_clusters (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  pillar_topic text NOT NULL,
  description text,
  target_keywords text[],
  created_at timestamptz DEFAULT NOW()
);

-- Blog Cluster Posts (junction)
CREATE TABLE IF NOT EXISTS blog_cluster_posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_id uuid REFERENCES blog_clusters(id) ON DELETE CASCADE,
  post_id uuid REFERENCES blog_posts(id) ON DELETE CASCADE,
  is_pillar boolean DEFAULT false,

  CONSTRAINT unique_cluster_post UNIQUE (cluster_id, post_id)
);

-- =============================================================================
-- SECTION 10: UPDATED AT TRIGGERS
-- =============================================================================

DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_services_updated_at ON services;
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_faqs_updated_at ON faqs;
CREATE TRIGGER update_faqs_updated_at
  BEFORE UPDATE ON faqs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_knowledge_updated_at ON knowledge;
CREATE TRIGGER update_knowledge_updated_at
  BEFORE UPDATE ON knowledge
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_config_updated_at ON ai_config;
CREATE TRIGGER update_ai_config_updated_at
  BEFORE UPDATE ON ai_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_call_settings_updated_at ON call_settings;
CREATE TRIGGER update_call_settings_updated_at
  BEFORE UPDATE ON call_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_calendar_integrations_updated_at ON calendar_integrations;
CREATE TRIGGER update_calendar_integrations_updated_at
  BEFORE UPDATE ON calendar_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_upsells_updated_at ON upsells;
CREATE TRIGGER update_upsells_updated_at
  BEFORE UPDATE ON upsells
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bundles_updated_at ON bundles;
CREATE TRIGGER update_bundles_updated_at
  BEFORE UPDATE ON bundles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_packages_updated_at ON packages;
CREATE TRIGGER update_packages_updated_at
  BEFORE UPDATE ON packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_memberships_updated_at ON memberships;
CREATE TRIGGER update_memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_caller_profiles_updated_at ON caller_profiles;
CREATE TRIGGER update_caller_profiles_updated_at
  BEFORE UPDATE ON caller_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- SECTION 11: STORED FUNCTIONS
-- =============================================================================

-- Increment caller count
CREATE OR REPLACE FUNCTION increment_caller_count(
  p_business_id uuid,
  p_phone_number text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO caller_profiles (business_id, phone_number, call_count, last_call_at)
  VALUES (p_business_id, p_phone_number, 1, NOW())
  ON CONFLICT (business_id, phone_number)
  DO UPDATE SET
    call_count = caller_profiles.call_count + 1,
    last_call_at = NOW(),
    updated_at = NOW();
END;
$$;

-- Update caller profile
CREATE OR REPLACE FUNCTION update_caller_profile(
  p_business_id uuid,
  p_phone_number text,
  p_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_outcome text DEFAULT NULL,
  p_preferences jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO caller_profiles (business_id, phone_number, name, email, last_outcome, preferences, last_call_at)
  VALUES (
    p_business_id, p_phone_number, p_name, p_email, p_outcome,
    COALESCE(p_preferences, '{}'::jsonb), NOW()
  )
  ON CONFLICT (business_id, phone_number)
  DO UPDATE SET
    name = COALESCE(NULLIF(p_name, ''), caller_profiles.name),
    email = COALESCE(NULLIF(p_email, ''), caller_profiles.email),
    last_outcome = COALESCE(p_outcome, caller_profiles.last_outcome),
    preferences = caller_profiles.preferences || COALESCE(p_preferences, '{}'::jsonb),
    call_count = caller_profiles.call_count + 1,
    last_call_at = NOW(),
    updated_at = NOW();
END;
$$;

-- Atomic increment function for usage minutes
CREATE OR REPLACE FUNCTION increment_usage_minutes(
  p_business_id uuid,
  p_minutes integer
)
RETURNS TABLE (
  id uuid,
  name text,
  minutes_used_this_cycle integer,
  current_cycle_start date,
  current_cycle_end date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_minutes <= 0 THEN
    RAISE EXCEPTION 'Minutes must be a positive integer';
  END IF;
  IF p_minutes > 1440 THEN
    RAISE EXCEPTION 'Minutes increment exceeds maximum allowed value (1440)';
  END IF;

  RETURN QUERY
  UPDATE businesses
  SET minutes_used_this_cycle = COALESCE(minutes_used_this_cycle, 0) + p_minutes
  WHERE businesses.id = p_business_id
  RETURNING
    businesses.id,
    businesses.name,
    businesses.minutes_used_this_cycle,
    businesses.current_cycle_start,
    businesses.current_cycle_end;
END;
$$;

-- Admin financial summary
CREATE OR REPLACE FUNCTION get_admin_financial_summary()
RETURNS TABLE (
  total_mrr_cents bigint,
  total_customers int,
  active_customers int,
  churned_customers int,
  arpu_cents numeric,
  new_customers_30d int,
  churned_customers_30d int
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(p.price_cents), 0)::bigint,
    COUNT(DISTINCT b.id)::int,
    COUNT(DISTINCT CASE WHEN b.subscription_status = 'active' THEN b.id END)::int,
    COUNT(DISTINCT CASE WHEN b.subscription_status = 'cancelled' THEN b.id END)::int,
    CASE
      WHEN COUNT(DISTINCT CASE WHEN b.subscription_status = 'active' THEN b.id END) > 0
      THEN ROUND(SUM(CASE WHEN b.subscription_status = 'active' THEN p.price_cents ELSE 0 END)::numeric /
           COUNT(DISTINCT CASE WHEN b.subscription_status = 'active' THEN b.id END), 0)
      ELSE 0
    END,
    COUNT(DISTINCT CASE WHEN b.created_at > NOW() - INTERVAL '30 days' THEN b.id END)::int,
    COUNT(DISTINCT CASE WHEN b.subscription_status = 'cancelled' AND b.updated_at > NOW() - INTERVAL '30 days' THEN b.id END)::int
  FROM businesses b
  LEFT JOIN plans p ON b.plan_id = p.id
  WHERE b.subscription_status != 'onboarding';
END;
$$;

-- =============================================================================
-- SECTION 12: VIEWS
-- =============================================================================

-- Admin business metrics view
CREATE OR REPLACE VIEW admin_business_metrics AS
SELECT
  b.id AS business_id,
  b.name AS business_name,
  b.subscription_status,
  b.created_at,
  b.updated_at,
  p.name AS plan_name,
  p.price_cents AS plan_price,
  b.minutes_used_this_cycle,
  b.minutes_included,
  CASE
    WHEN b.minutes_included > 0
    THEN ROUND((b.minutes_used_this_cycle::numeric / b.minutes_included) * 100, 1)
    ELSE 0
  END AS usage_percent,
  (SELECT COUNT(*) FROM calls c WHERE c.business_id = b.id) AS total_calls,
  (SELECT COUNT(*) FROM appointments a WHERE a.business_id = b.id) AS total_appointments,
  u.email AS owner_email
FROM businesses b
LEFT JOIN plans p ON b.plan_id = p.id
LEFT JOIN users u ON b.user_id = u.id;

-- Caller insights view
CREATE OR REPLACE VIEW caller_insights AS
SELECT
  cp.business_id,
  cp.phone_number,
  cp.name,
  cp.call_count,
  cp.last_call_at,
  cp.last_outcome,
  cp.preferences,
  CASE
    WHEN cp.call_count >= 5 THEN 'vip'
    WHEN cp.call_count >= 2 THEN 'returning'
    ELSE 'new'
  END AS caller_tier,
  (SELECT COUNT(*) FROM appointments a WHERE a.customer_phone = cp.phone_number AND a.business_id = cp.business_id) AS appointment_count,
  (SELECT a.service_name FROM appointments a WHERE a.customer_phone = cp.phone_number AND a.business_id = cp.business_id ORDER BY a.scheduled_at DESC LIMIT 1) AS last_service_booked
FROM caller_profiles cp;

-- =============================================================================
-- SECTION 13: ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE caller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE upsells ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE demo_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_regeneration_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies should be created separately as they require DROP IF EXISTS
-- which can be complex. See migrations for policy definitions.

-- =============================================================================
-- SECTION 14: GRANTS
-- =============================================================================

GRANT EXECUTE ON FUNCTION increment_caller_count TO authenticated;
GRANT EXECUTE ON FUNCTION increment_caller_count TO service_role;
GRANT EXECUTE ON FUNCTION update_caller_profile TO authenticated;
GRANT EXECUTE ON FUNCTION update_caller_profile TO service_role;
GRANT EXECUTE ON FUNCTION increment_usage_minutes(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_usage_minutes(uuid, integer) TO service_role;
GRANT SELECT ON caller_insights TO authenticated;
GRANT SELECT ON caller_insights TO service_role;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
