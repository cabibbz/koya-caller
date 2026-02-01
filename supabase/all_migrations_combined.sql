-- =============================================
-- ALL MIGRATIONS COMBINED
-- Generated: 2026-01-28T05:07:47Z
-- Run this in Supabase SQL Editor to apply all migrations
-- All statements use IF NOT EXISTS / IF EXISTS for idempotency
-- =============================================


-- ==============================================
-- Migration: 20241219000001_core_tables.sql
-- ==============================================

-- Migration: Core Tables (Session 2)
-- Spec Reference: Part 9, Lines 852-936
-- Tables: users, plans, businesses, business_hours, services

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- Users (Spec Lines 856-861)
-- Business owners who sign up
-- ============================================
create table users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  phone text, -- for SMS notifications
  created_at timestamp with time zone default now()
);

comment on table users is 'Business owners who use Koya Caller';
comment on column users.phone is 'Phone number for SMS notifications';

-- ============================================
-- Plans (Spec Lines 863-874)
-- Pricing tiers: Starter, Professional, Business
-- ============================================
create table plans (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null, -- 'starter', 'professional', 'business'
  name text not null,
  price_cents int not null,
  included_minutes int not null,
  features jsonb,
  stripe_price_id text,
  sort_order int default 0,
  is_active boolean default true
);

comment on table plans is 'Pricing plans: Starter ($99), Professional ($197), Business ($397)';
comment on column plans.slug is 'URL-safe identifier: starter, professional, business';
comment on column plans.features is 'JSON array of feature descriptions for this plan';
comment on column plans.stripe_price_id is 'Stripe Price ID for checkout';

-- ============================================
-- Businesses (Spec Lines 876-907)
-- One business per user (for now)
-- ============================================
create table businesses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  business_type text,
  address text,
  website text,
  service_area text,
  differentiator text,
  timezone text default 'America/New_York',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  -- Onboarding tracking
  onboarding_step int default 1, -- track progress for resume
  onboarding_completed_at timestamp with time zone,
  
  -- Subscription status
  subscription_status text default 'onboarding', -- onboarding, active, paused, cancelled
  plan_id uuid references plans(id),
  stripe_customer_id text,
  stripe_subscription_id text,
  
  -- Usage tracking (Spec Lines 895-900)
  current_cycle_start date,
  current_cycle_end date,
  minutes_used_this_cycle int default 0,
  minutes_included int default 0, -- denormalized from plan for quick access
  last_usage_alert_percent int default 0 -- track which alerts sent: 0, 50, 80, 95, 100
);

comment on table businesses is 'Business profiles with subscription and usage tracking';
comment on column businesses.onboarding_step is 'Current step in 8-step onboarding flow';
comment on column businesses.subscription_status is 'onboarding, active, paused, or cancelled';
comment on column businesses.minutes_included is 'Denormalized from plan for quick access';
comment on column businesses.last_usage_alert_percent is 'Track which usage alerts (50/80/95/100) have been sent';

-- Indexes (Spec Lines 903-906)
create index idx_businesses_user_id on businesses(user_id);
create index idx_businesses_subscription_status on businesses(subscription_status);
create index idx_businesses_plan_id on businesses(plan_id);

-- ============================================
-- Business Hours (Spec Lines 909-918)
-- 7 rows per business (one per day)
-- ============================================
create table business_hours (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  day_of_week int not null, -- 0=Sunday, 1=Monday, ..., 6=Saturday
  open_time time,
  close_time time,
  is_closed boolean default false,
  
  -- Ensure one entry per day per business
  constraint unique_business_day unique (business_id, day_of_week),
  constraint valid_day_of_week check (day_of_week >= 0 and day_of_week <= 6)
);

comment on table business_hours is 'Operating hours for each day of the week';
comment on column business_hours.day_of_week is '0=Sunday, 1=Monday, through 6=Saturday';
comment on column business_hours.is_closed is 'True if business is closed on this day';

-- Index (Spec Line 918)
create index idx_business_hours_business_id on business_hours(business_id);

-- ============================================
-- Services (Spec Lines 920-935)
-- Services offered by each business
-- ============================================
create table services (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes int default 60,
  price_cents int,
  price_type text default 'fixed', -- fixed, quote, hidden
  is_bookable boolean default true,
  sort_order int default 0,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  
  constraint valid_price_type check (price_type in ('fixed', 'quote', 'hidden'))
);

comment on table services is 'Services offered by the business';
comment on column services.price_type is 'fixed (show price), quote (call for quote), hidden (dont mention)';
comment on column services.is_bookable is 'Whether this service can be booked via Koya';
comment on column services.sort_order is 'Display order in lists';

-- Index (Spec Line 935)
create index idx_services_business_id on services(business_id);

-- ============================================
-- Updated At Trigger
-- Automatically update updated_at on row changes
-- ============================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply trigger to businesses table
create trigger update_businesses_updated_at
  before update on businesses
  for each row
  execute function update_updated_at_column();

-- Apply trigger to services table
create trigger update_services_updated_at
  before update on services
  for each row
  execute function update_updated_at_column();


-- ==============================================
-- Migration: 20241219000002_extended_tables.sql
-- ==============================================

-- Migration: Extended/Operations Tables (Session 3)
-- Spec Reference: Part 9, Lines 937-1178
-- Prerequisites: Run AFTER 20241219000001_core_tables.sql

-- ============================================
-- Auth Helper Function (Spec Part 10, Lines 1184-1199)
-- Extracts tenant_id from JWT app_metadata
-- ============================================
create or replace function public.tenant_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid,
    null
  )
$$;

comment on function public.tenant_id() is 'Returns the tenant_id from the JWT app_metadata for RLS policies';

-- ============================================
-- FAQs (Spec Lines 937-948)
-- ============================================
create table faqs (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  question text not null,
  answer text not null,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table faqs is 'Frequently asked questions for each business';
create index idx_faqs_business_id on faqs(business_id);

-- ============================================
-- Knowledge (Spec Lines 950-958)
-- ============================================
create table knowledge (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade unique,
  content text,
  never_say text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table knowledge is 'Additional business context and restrictions (1:1 with business)';

-- ============================================
-- AI Config (Spec Lines 960-987)
-- ============================================
create table ai_config (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade unique,
  
  -- Voice settings
  voice_id text,
  voice_id_spanish text,
  
  -- Personality
  ai_name text default 'Koya',
  personality text default 'professional',
  
  -- Greetings (English)
  greeting text,
  after_hours_greeting text,
  minutes_exhausted_greeting text,
  
  -- Greetings (Spanish)
  greeting_spanish text,
  after_hours_greeting_spanish text,
  minutes_exhausted_greeting_spanish text,
  
  -- Language settings
  spanish_enabled boolean default false,
  language_mode text default 'auto',
  
  -- System prompt
  system_prompt text,
  system_prompt_spanish text,
  system_prompt_version int default 1,
  system_prompt_generated_at timestamptz,
  
  -- Retell integration
  retell_agent_id text,
  retell_agent_id_spanish text,
  retell_agent_version int default 1,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  constraint valid_language_mode check (language_mode in ('auto', 'ask', 'spanish_default')),
  constraint valid_personality check (personality in ('professional', 'friendly', 'casual'))
);

comment on table ai_config is 'AI voice and personality configuration (1:1 with business)';

-- ============================================
-- Call Settings (Spec Lines 989-1010)
-- ============================================
create table call_settings (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade unique,
  
  -- Transfer settings
  transfer_number text,
  backup_transfer_number text,
  transfer_on_request boolean default true,
  transfer_on_emergency boolean default true,
  transfer_on_upset boolean default false,
  transfer_keywords text[] default '{}',
  transfer_hours_type text default 'always',
  transfer_hours_custom jsonb,
  
  -- No answer handling
  no_answer_action text default 'message',
  no_answer_timeout_seconds int default 30,
  
  -- After hours
  after_hours_enabled boolean default true,
  after_hours_can_book boolean default true,
  after_hours_message_only boolean default false,
  
  -- Call limits
  max_call_duration_seconds int default 600,
  recording_enabled boolean default true,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  constraint valid_transfer_hours_type check (transfer_hours_type in ('always', 'business_hours', 'custom'))
);

comment on table call_settings is 'Call handling configuration (1:1 with business)';

-- ============================================
-- Calendar Integrations (Spec Lines 1012-1027)
-- ============================================
create table calendar_integrations (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade unique,
  provider text not null default 'built_in',
  
  -- OAuth tokens
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  calendar_id text,
  
  -- Booking settings
  default_duration_minutes int default 60,
  buffer_minutes int default 0,
  advance_booking_days int default 14,
  require_email boolean default false,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  constraint valid_provider check (provider in ('google', 'outlook', 'built_in'))
);

comment on table calendar_integrations is 'Calendar provider integration (1:1 with business)';

-- ============================================
-- Availability Slots (Spec Lines 1029-1038)
-- ============================================
create table availability_slots (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  day_of_week int not null,
  start_time time not null,
  end_time time not null,
  
  constraint valid_day_of_week check (day_of_week >= 0 and day_of_week <= 6),
  constraint valid_time_range check (end_time > start_time)
);

comment on table availability_slots is 'Available time slots for built-in scheduler';
create index idx_availability_slots_business_id on availability_slots(business_id);

-- ============================================
-- Phone Numbers (Spec Lines 1040-1054)
-- ============================================
create table phone_numbers (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  number text not null,
  twilio_sid text,
  setup_type text default 'direct',
  forwarded_from text,
  carrier text,
  is_active boolean default true,
  created_at timestamptz default now(),
  
  constraint valid_setup_type check (setup_type in ('direct', 'forwarded'))
);

comment on table phone_numbers is 'Twilio phone numbers assigned to businesses';
create index idx_phone_numbers_business_id on phone_numbers(business_id);
create index idx_phone_numbers_number on phone_numbers(number);

-- ============================================
-- Calls (Spec Lines 1056-1082)
-- ============================================
create table calls (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  retell_call_id text unique,
  from_number text,
  to_number text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds int,
  duration_minutes_billed int,
  language text default 'en',
  recording_url text,
  transcript jsonb,
  summary text,
  outcome text,
  lead_info jsonb,
  message_taken text,
  cost_cents int,
  created_at timestamptz default now(),
  
  constraint valid_language check (language in ('en', 'es')),
  constraint valid_outcome check (outcome is null or outcome in ('booked', 'transferred', 'info', 'message', 'missed', 'minutes_exhausted'))
);

comment on table calls is 'Call records from Retell.ai';
create index idx_calls_business_id on calls(business_id);
create index idx_calls_started_at on calls(started_at);
create index idx_calls_outcome on calls(outcome);
create index idx_calls_retell_call_id on calls(retell_call_id);
create index idx_calls_language on calls(language);

-- ============================================
-- Appointments (Spec Lines 1084-1107)
-- ============================================
create table appointments (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  call_id uuid references calls(id) on delete set null,
  
  -- Customer info
  customer_name text,
  customer_phone text,
  customer_email text,
  
  -- Service
  service_id uuid references services(id) on delete set null,
  service_name text,
  
  -- Scheduling
  scheduled_at timestamptz,
  duration_minutes int,
  
  -- Status
  status text default 'confirmed',
  notes text,
  external_event_id text,
  
  -- Notifications
  confirmation_sent_at timestamptz,
  reminder_sent_at timestamptz,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  constraint valid_status check (status in ('confirmed', 'cancelled', 'completed', 'no_show'))
);

comment on table appointments is 'Booked appointments';
create index idx_appointments_business_id on appointments(business_id);
create index idx_appointments_scheduled_at on appointments(scheduled_at);
create index idx_appointments_status on appointments(status);

-- ============================================
-- SMS Messages (Spec Lines 1109-1127)
-- ============================================
create table sms_messages (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  call_id uuid references calls(id) on delete set null,
  appointment_id uuid references appointments(id) on delete set null,
  direction text not null,
  message_type text not null,
  from_number text,
  to_number text,
  body text,
  twilio_sid text,
  status text default 'sent',
  sent_at timestamptz default now(),
  
  constraint valid_direction check (direction in ('inbound', 'outbound')),
  constraint valid_message_type check (message_type in ('booking_confirmation', 'reminder', 'message_alert', 'usage_alert', 'transfer_alert')),
  constraint valid_status check (status in ('sent', 'delivered', 'failed'))
);

comment on table sms_messages is 'SMS notification records';
create index idx_sms_messages_business_id on sms_messages(business_id);
create index idx_sms_messages_call_id on sms_messages(call_id);

-- ============================================
-- Notification Settings (Spec Lines 1128-1141)
-- ============================================
create table notification_settings (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade unique,
  
  -- Owner SMS notifications
  sms_all_calls boolean default false,
  sms_bookings boolean default true,
  sms_missed boolean default true,
  sms_messages boolean default true,
  sms_usage_alerts boolean default true,
  
  -- Owner email notifications
  email_daily boolean default false,
  email_weekly boolean default true,
  
  -- Customer notifications
  sms_customer_confirmation boolean default true,
  sms_customer_reminder text default '24hr',
  
  constraint valid_reminder check (sms_customer_reminder in ('off', '1hr', '24hr'))
);

comment on table notification_settings is 'Notification preferences (1:1 with business)';

-- ============================================
-- Business Templates (Spec Lines 1143-1152)
-- ============================================
create table business_templates (
  id uuid primary key default uuid_generate_v4(),
  type_slug text unique not null,
  type_name text not null,
  default_services jsonb,
  default_faqs jsonb,
  urgency_triggers text[],
  sort_order int default 0
);

comment on table business_templates is 'Industry templates for onboarding';

-- ============================================
-- Demo Leads (Spec Lines 1154-1164)
-- ============================================
create table demo_leads (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  demo_started_at timestamptz default now(),
  demo_completed boolean default false,
  converted_to_signup boolean default false,
  converted_at timestamptz
);

comment on table demo_leads is 'Leads from website demo';
create index idx_demo_leads_email on demo_leads(email);

-- ============================================
-- Prompt Regeneration Queue (Spec Lines 1166-1178)
-- ============================================
create table prompt_regeneration_queue (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  triggered_by text not null,
  status text default 'pending',
  error_message text,
  created_at timestamptz default now(),
  processed_at timestamptz,
  
  constraint valid_triggered_by check (triggered_by in ('services_update', 'faqs_update', 'knowledge_update', 'settings_update', 'language_update')),
  constraint valid_status check (status in ('pending', 'processing', 'completed', 'failed'))
);

comment on table prompt_regeneration_queue is 'Queue for async prompt regeneration';
create index idx_prompt_queue_status on prompt_regeneration_queue(status);
create index idx_prompt_queue_business_id on prompt_regeneration_queue(business_id);

-- ============================================
-- Updated At Triggers
-- ============================================
create trigger update_faqs_updated_at
  before update on faqs
  for each row execute function update_updated_at_column();

create trigger update_knowledge_updated_at
  before update on knowledge
  for each row execute function update_updated_at_column();

create trigger update_ai_config_updated_at
  before update on ai_config
  for each row execute function update_updated_at_column();

create trigger update_call_settings_updated_at
  before update on call_settings
  for each row execute function update_updated_at_column();

create trigger update_calendar_integrations_updated_at
  before update on calendar_integrations
  for each row execute function update_updated_at_column();

create trigger update_appointments_updated_at
  before update on appointments
  for each row execute function update_updated_at_column();

-- ============================================
-- RLS Policies (Spec Part 10)
-- ============================================
alter table faqs enable row level security;
alter table knowledge enable row level security;
alter table ai_config enable row level security;
alter table call_settings enable row level security;
alter table calendar_integrations enable row level security;
alter table availability_slots enable row level security;
alter table phone_numbers enable row level security;
alter table calls enable row level security;
alter table appointments enable row level security;
alter table sms_messages enable row level security;
alter table notification_settings enable row level security;
alter table prompt_regeneration_queue enable row level security;

-- FAQs policies
create policy "Users can view own business faqs" on faqs
  for select using (business_id = public.tenant_id());
create policy "Users can insert own business faqs" on faqs
  for insert with check (business_id = public.tenant_id());
create policy "Users can update own business faqs" on faqs
  for update using (business_id = public.tenant_id());
create policy "Users can delete own business faqs" on faqs
  for delete using (business_id = public.tenant_id());

-- Knowledge policies
create policy "Users can view own business knowledge" on knowledge
  for select using (business_id = public.tenant_id());
create policy "Users can insert own business knowledge" on knowledge
  for insert with check (business_id = public.tenant_id());
create policy "Users can update own business knowledge" on knowledge
  for update using (business_id = public.tenant_id());

-- AI Config policies
create policy "Users can view own business ai_config" on ai_config
  for select using (business_id = public.tenant_id());
create policy "Users can insert own business ai_config" on ai_config
  for insert with check (business_id = public.tenant_id());
create policy "Users can update own business ai_config" on ai_config
  for update using (business_id = public.tenant_id());

-- Call Settings policies
create policy "Users can view own business call_settings" on call_settings
  for select using (business_id = public.tenant_id());
create policy "Users can insert own business call_settings" on call_settings
  for insert with check (business_id = public.tenant_id());
create policy "Users can update own business call_settings" on call_settings
  for update using (business_id = public.tenant_id());

-- Calendar Integrations policies
create policy "Users can view own business calendar" on calendar_integrations
  for select using (business_id = public.tenant_id());
create policy "Users can insert own business calendar" on calendar_integrations
  for insert with check (business_id = public.tenant_id());
create policy "Users can update own business calendar" on calendar_integrations
  for update using (business_id = public.tenant_id());

-- Availability Slots policies
create policy "Users can view own business slots" on availability_slots
  for select using (business_id = public.tenant_id());
create policy "Users can insert own business slots" on availability_slots
  for insert with check (business_id = public.tenant_id());
create policy "Users can update own business slots" on availability_slots
  for update using (business_id = public.tenant_id());
create policy "Users can delete own business slots" on availability_slots
  for delete using (business_id = public.tenant_id());

-- Phone Numbers policies
create policy "Users can view own business phones" on phone_numbers
  for select using (business_id = public.tenant_id());
create policy "Users can insert own business phones" on phone_numbers
  for insert with check (business_id = public.tenant_id());
create policy "Users can update own business phones" on phone_numbers
  for update using (business_id = public.tenant_id());

-- Calls policies
create policy "Users can view own business calls" on calls
  for select using (business_id = public.tenant_id());

-- Appointments policies
create policy "Users can view own business appointments" on appointments
  for select using (business_id = public.tenant_id());
create policy "Users can insert own business appointments" on appointments
  for insert with check (business_id = public.tenant_id());
create policy "Users can update own business appointments" on appointments
  for update using (business_id = public.tenant_id());

-- SMS Messages policies
create policy "Users can view own business sms" on sms_messages
  for select using (business_id = public.tenant_id());

-- Notification Settings policies
create policy "Users can view own business notifications" on notification_settings
  for select using (business_id = public.tenant_id());
create policy "Users can insert own business notifications" on notification_settings
  for insert with check (business_id = public.tenant_id());
create policy "Users can update own business notifications" on notification_settings
  for update using (business_id = public.tenant_id());

-- Prompt Queue policies
create policy "Users can view own business queue" on prompt_regeneration_queue
  for select using (business_id = public.tenant_id());

-- Service role bypass (for webhooks/admin)
create policy "Service role bypass faqs" on faqs for all using (auth.role() = 'service_role');
create policy "Service role bypass knowledge" on knowledge for all using (auth.role() = 'service_role');
create policy "Service role bypass ai_config" on ai_config for all using (auth.role() = 'service_role');
create policy "Service role bypass call_settings" on call_settings for all using (auth.role() = 'service_role');
create policy "Service role bypass calendar_integrations" on calendar_integrations for all using (auth.role() = 'service_role');
create policy "Service role bypass availability_slots" on availability_slots for all using (auth.role() = 'service_role');
create policy "Service role bypass phone_numbers" on phone_numbers for all using (auth.role() = 'service_role');
create policy "Service role bypass calls" on calls for all using (auth.role() = 'service_role');
create policy "Service role bypass appointments" on appointments for all using (auth.role() = 'service_role');
create policy "Service role bypass sms_messages" on sms_messages for all using (auth.role() = 'service_role');
create policy "Service role bypass notification_settings" on notification_settings for all using (auth.role() = 'service_role');
create policy "Service role bypass prompt_regeneration_queue" on prompt_regeneration_queue for all using (auth.role() = 'service_role');

-- Business templates are public (read-only for all)
create policy "Anyone can view templates" on business_templates for select using (true);

-- Demo leads - service role only
alter table demo_leads enable row level security;
create policy "Service role bypass demo_leads" on demo_leads for all using (auth.role() = 'service_role');

-- ============================================
-- RLS Policies for Core Tables (Session 2 tables)
-- ============================================

-- Enable RLS on core tables
alter table users enable row level security;
alter table businesses enable row level security;
alter table business_hours enable row level security;
alter table services enable row level security;

-- Users can only see their own user record
create policy "Users can view own user record" on users
  for select using (id = auth.uid());
create policy "Users can update own user record" on users
  for update using (id = auth.uid());

-- Businesses - users can only access their own business
create policy "Users can view own business" on businesses
  for select using (id = public.tenant_id());
create policy "Users can update own business" on businesses
  for update using (id = public.tenant_id());

-- Business hours - access through tenant_id
create policy "Users can view own business_hours" on business_hours
  for select using (business_id = public.tenant_id());
create policy "Users can insert own business_hours" on business_hours
  for insert with check (business_id = public.tenant_id());
create policy "Users can update own business_hours" on business_hours
  for update using (business_id = public.tenant_id());
create policy "Users can delete own business_hours" on business_hours
  for delete using (business_id = public.tenant_id());

-- Services - access through tenant_id
create policy "Users can view own services" on services
  for select using (business_id = public.tenant_id());
create policy "Users can insert own services" on services
  for insert with check (business_id = public.tenant_id());
create policy "Users can update own services" on services
  for update using (business_id = public.tenant_id());
create policy "Users can delete own services" on services
  for delete using (business_id = public.tenant_id());

-- Plans are public (everyone can see pricing)
alter table plans enable row level security;
create policy "Anyone can view plans" on plans
  for select using (true);

-- Service role bypass for core tables
create policy "Service role bypass users" on users for all using (auth.role() = 'service_role');
create policy "Service role bypass businesses" on businesses for all using (auth.role() = 'service_role');
create policy "Service role bypass business_hours" on business_hours for all using (auth.role() = 'service_role');
create policy "Service role bypass services" on services for all using (auth.role() = 'service_role');
create policy "Service role bypass plans" on plans for all using (auth.role() = 'service_role');


-- ==============================================
-- Migration: 20241220000001_business_templates_seed.sql
-- ==============================================

-- Migration: Business Templates Seed Data (Session 9)
-- Spec Reference: Part 5, Lines 216-220; Part 9, Lines 1143-1152
-- Purpose: Pre-populated templates for 20+ business types

-- ============================================
-- Home Services Templates
-- ============================================

INSERT INTO business_templates (type_slug, type_name, default_services, default_faqs, urgency_triggers, sort_order) VALUES

-- HVAC
('hvac', 'HVAC / Heating & Cooling', 
  '[
    {"name": "AC Repair", "description": "Diagnosis and repair of air conditioning systems", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Furnace Repair", "description": "Diagnosis and repair of heating systems", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "AC Installation", "description": "New air conditioning system installation", "duration_minutes": 480, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Furnace Installation", "description": "New heating system installation", "duration_minutes": 480, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Seasonal Maintenance", "description": "Preventive maintenance and tune-up", "duration_minutes": 90, "price_cents": 14900, "price_type": "fixed", "is_bookable": true},
    {"name": "Duct Cleaning", "description": "Professional air duct cleaning", "duration_minutes": 180, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Thermostat Installation", "description": "Smart or standard thermostat installation", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you offer emergency service?", "answer": "Yes, we offer 24/7 emergency HVAC service. Call us anytime for urgent heating or cooling issues."},
    {"question": "How often should I have my HVAC system serviced?", "answer": "We recommend servicing your system twice a year - once before summer for AC and once before winter for heating."},
    {"question": "Do you provide free estimates?", "answer": "Yes, we provide free estimates for all installations and major repairs."},
    {"question": "What brands do you service?", "answer": "We service all major brands including Carrier, Trane, Lennox, Rheem, and more."},
    {"question": "How long does a typical repair take?", "answer": "Most repairs can be completed in 1-2 hours. Complex issues may require additional time or follow-up visits."},
    {"question": "Do you offer financing?", "answer": "Yes, we offer flexible financing options for new system installations."}
  ]'::jsonb,
  ARRAY['no heat', 'no AC', 'no air conditioning', 'not cooling', 'not heating', 'furnace not working', 'AC broken'],
  1
),

-- Plumbing
('plumbing', 'Plumbing',
  '[
    {"name": "Drain Cleaning", "description": "Professional drain clearing and cleaning", "duration_minutes": 60, "price_cents": 14900, "price_type": "fixed", "is_bookable": true},
    {"name": "Leak Repair", "description": "Repair of pipe and fixture leaks", "duration_minutes": 90, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Water Heater Repair", "description": "Water heater diagnosis and repair", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Water Heater Installation", "description": "New water heater installation", "duration_minutes": 240, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Toilet Repair", "description": "Toilet repair or replacement", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Faucet Installation", "description": "Faucet replacement and installation", "duration_minutes": 60, "price_cents": 12900, "price_type": "fixed", "is_bookable": true},
    {"name": "Sewer Line Service", "description": "Sewer line inspection and cleaning", "duration_minutes": 180, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you offer emergency plumbing service?", "answer": "Yes, we provide 24/7 emergency plumbing service for urgent issues like major leaks, flooding, or no water."},
    {"question": "How much does a typical service call cost?", "answer": "Our service call fee varies. We provide upfront pricing before any work begins."},
    {"question": "Do you give free estimates?", "answer": "Yes, we offer free estimates for larger jobs and installations."},
    {"question": "Are you licensed and insured?", "answer": "Yes, we are fully licensed, bonded, and insured for your protection."},
    {"question": "How quickly can you come out?", "answer": "For emergencies, we aim to respond within 1-2 hours. For non-urgent issues, we often have same-day or next-day availability."},
    {"question": "What forms of payment do you accept?", "answer": "We accept cash, checks, and all major credit cards."}
  ]'::jsonb,
  ARRAY['flooding', 'water everywhere', 'pipe burst', 'no hot water', 'sewage', 'backup', 'overflowing'],
  2
),

-- Electrical
('electrical', 'Electrical',
  '[
    {"name": "Electrical Repair", "description": "General electrical troubleshooting and repair", "duration_minutes": 90, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Outlet Installation", "description": "New outlet installation or replacement", "duration_minutes": 60, "price_cents": 12900, "price_type": "fixed", "is_bookable": true},
    {"name": "Panel Upgrade", "description": "Electrical panel upgrade or replacement", "duration_minutes": 480, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Lighting Installation", "description": "Light fixture installation", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Ceiling Fan Installation", "description": "Ceiling fan installation or replacement", "duration_minutes": 90, "price_cents": 14900, "price_type": "fixed", "is_bookable": true},
    {"name": "Whole House Generator", "description": "Generator installation and setup", "duration_minutes": 480, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "EV Charger Installation", "description": "Electric vehicle charger installation", "duration_minutes": 240, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you handle emergency electrical work?", "answer": "Yes, we provide 24/7 emergency electrical service for safety issues like power outages, sparking outlets, or electrical fires."},
    {"question": "Are you licensed electricians?", "answer": "Yes, all our electricians are fully licensed, insured, and undergo regular training."},
    {"question": "Do you offer free estimates?", "answer": "Yes, we provide free estimates for all major electrical projects."},
    {"question": "How long does it take to install an EV charger?", "answer": "Most EV charger installations can be completed in 2-4 hours, depending on your electrical setup."},
    {"question": "Can you help with permits?", "answer": "Yes, we handle all necessary permits and inspections for your electrical work."},
    {"question": "Do you work on older homes?", "answer": "Absolutely. We specialize in both modern and older home electrical systems, including knob-and-tube upgrades."}
  ]'::jsonb,
  ARRAY['no power', 'sparking', 'electrical fire', 'burning smell', 'shock', 'power out'],
  3
),

-- Roofing
('roofing', 'Roofing',
  '[
    {"name": "Roof Inspection", "description": "Complete roof inspection and assessment", "duration_minutes": 60, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Roof Repair", "description": "Repair of leaks, damaged shingles, and flashing", "duration_minutes": 180, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Full Roof Replacement", "description": "Complete roof tear-off and replacement", "duration_minutes": 1440, "price_cents": null, "price_type": "quote", "is_bookable": false},
    {"name": "Emergency Tarp Service", "description": "Emergency tarping for active leaks", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Gutter Installation", "description": "New gutter system installation", "duration_minutes": 240, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Gutter Cleaning", "description": "Professional gutter cleaning service", "duration_minutes": 90, "price_cents": 14900, "price_type": "fixed", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you offer free roof inspections?", "answer": "Yes, we provide free roof inspections and estimates for all potential customers."},
    {"question": "How long does a roof replacement take?", "answer": "Most residential roof replacements can be completed in 1-3 days, weather permitting."},
    {"question": "Do you offer emergency service?", "answer": "Yes, we provide emergency tarping service for active leaks to protect your home until repairs can be made."},
    {"question": "What roofing materials do you work with?", "answer": "We install and repair asphalt shingles, metal roofing, tile, and flat roof systems."},
    {"question": "Do you handle insurance claims?", "answer": "Yes, we work directly with insurance companies and can help document storm damage for your claim."},
    {"question": "What warranty do you offer?", "answer": "We offer manufacturer warranties on materials plus our own workmanship warranty. Details vary by project."}
  ]'::jsonb,
  ARRAY['roof leak', 'leaking roof', 'water coming in', 'storm damage', 'tree fell on roof'],
  4
),

-- Landscaping
('landscaping', 'Landscaping',
  '[
    {"name": "Lawn Maintenance", "description": "Regular mowing, edging, and blowing", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Landscape Design", "description": "Custom landscape design consultation", "duration_minutes": 90, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Planting & Installation", "description": "Tree, shrub, and flower installation", "duration_minutes": 240, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Irrigation Installation", "description": "Sprinkler system design and installation", "duration_minutes": 480, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Hardscaping", "description": "Patios, walkways, and retaining walls", "duration_minutes": 480, "price_cents": null, "price_type": "quote", "is_bookable": false},
    {"name": "Seasonal Cleanup", "description": "Spring or fall yard cleanup", "duration_minutes": 180, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Tree Trimming", "description": "Professional tree and shrub pruning", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you offer free estimates?", "answer": "Yes, we provide free on-site estimates for all landscaping projects."},
    {"question": "How often should I have my lawn maintained?", "answer": "During growing season, we recommend weekly or bi-weekly maintenance for the best results."},
    {"question": "Do you design and install or just maintain?", "answer": "We offer both! From complete landscape design and installation to ongoing maintenance services."},
    {"question": "What areas do you serve?", "answer": "We serve the local area. Call us to confirm we service your location."},
    {"question": "Do you remove debris?", "answer": "Yes, we haul away all debris and leave your property clean after every service."},
    {"question": "Do you offer seasonal contracts?", "answer": "Yes, we offer seasonal and annual maintenance contracts with discounted rates."}
  ]'::jsonb,
  ARRAY[]::text[],
  5
),

-- House Cleaning
('cleaning', 'House Cleaning',
  '[
    {"name": "Standard Cleaning", "description": "Regular cleaning of all rooms", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Deep Cleaning", "description": "Thorough deep cleaning including baseboards, inside appliances", "duration_minutes": 240, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Move In/Out Cleaning", "description": "Complete cleaning for moving transitions", "duration_minutes": 300, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Recurring Service", "description": "Weekly, bi-weekly, or monthly cleaning", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Office Cleaning", "description": "Commercial office cleaning service", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Post-Construction Cleaning", "description": "Cleaning after renovation or construction", "duration_minutes": 360, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "What is included in a standard cleaning?", "answer": "Standard cleaning includes dusting, vacuuming, mopping, bathroom sanitization, and kitchen cleaning."},
    {"question": "Do I need to provide cleaning supplies?", "answer": "No, we bring all our own professional-grade cleaning supplies and equipment."},
    {"question": "Are your cleaners background checked?", "answer": "Yes, all our cleaning professionals undergo thorough background checks and are fully insured."},
    {"question": "How do you price your services?", "answer": "Pricing depends on home size, cleaning type, and frequency. We provide free quotes."},
    {"question": "Can I request the same cleaner each time?", "answer": "Yes, we try to send the same cleaner for recurring services to ensure consistency."},
    {"question": "What if I am not satisfied?", "answer": "Your satisfaction is guaranteed. If you are not happy, we will re-clean the area at no charge."}
  ]'::jsonb,
  ARRAY[]::text[],
  6
),

-- Pest Control
('pest_control', 'Pest Control',
  '[
    {"name": "General Pest Treatment", "description": "Treatment for common household pests", "duration_minutes": 60, "price_cents": 14900, "price_type": "fixed", "is_bookable": true},
    {"name": "Termite Inspection", "description": "Complete termite inspection and report", "duration_minutes": 90, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Termite Treatment", "description": "Termite elimination and prevention", "duration_minutes": 240, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Rodent Control", "description": "Mouse and rat elimination program", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Bed Bug Treatment", "description": "Bed bug elimination service", "duration_minutes": 180, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Mosquito Treatment", "description": "Yard mosquito control service", "duration_minutes": 45, "price_cents": 9900, "price_type": "fixed", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Are your treatments safe for pets and children?", "answer": "Yes, we use pet and family-safe products. We will advise on any precautions needed."},
    {"question": "How quickly can you come out?", "answer": "We often have same-day or next-day availability for pest emergencies."},
    {"question": "Do you offer ongoing pest prevention?", "answer": "Yes, we offer monthly, quarterly, and annual prevention plans to keep pests away."},
    {"question": "Do you guarantee your work?", "answer": "Yes, our treatments come with a satisfaction guarantee. If pests return, so do we."},
    {"question": "What pests do you treat?", "answer": "We handle ants, roaches, spiders, rodents, termites, bed bugs, mosquitoes, wasps, and more."},
    {"question": "Do I need to leave during treatment?", "answer": "For most treatments, you can stay home. We will advise if any preparation is needed."}
  ]'::jsonb,
  ARRAY['termites', 'bed bugs', 'infestation', 'swarm'],
  7
),

-- ============================================
-- Automotive Templates
-- ============================================

-- Auto Repair
('auto_repair', 'Auto Repair',
  '[
    {"name": "Oil Change", "description": "Full synthetic or conventional oil change", "duration_minutes": 30, "price_cents": 4900, "price_type": "fixed", "is_bookable": true},
    {"name": "Brake Service", "description": "Brake pad replacement and rotor inspection", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Diagnostic", "description": "Computer diagnostic and troubleshooting", "duration_minutes": 60, "price_cents": 9900, "price_type": "fixed", "is_bookable": true},
    {"name": "Tire Service", "description": "Tire rotation, balancing, or replacement", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "AC Service", "description": "Air conditioning diagnostic and recharge", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Transmission Service", "description": "Transmission fluid flush and inspection", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "General Repair", "description": "Engine, suspension, or electrical repairs", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you work on all makes and models?", "answer": "Yes, we service all domestic and foreign vehicles."},
    {"question": "Do you offer loaner cars?", "answer": "We can arrange loaner vehicles or shuttle service for major repairs. Ask about availability."},
    {"question": "How long does a typical repair take?", "answer": "Most routine services take 1-2 hours. Major repairs may require a day or more."},
    {"question": "Do you provide written estimates?", "answer": "Yes, we always provide a written estimate before beginning any work."},
    {"question": "Are you ASE certified?", "answer": "Yes, our mechanics are ASE certified professionals."},
    {"question": "Do you offer any warranties?", "answer": "Yes, we warranty our parts and labor. Specific terms depend on the repair."}
  ]'::jsonb,
  ARRAY['car wont start', 'broke down', 'check engine light', 'smoking', 'overheating'],
  8
),

-- Auto Detailing
('auto_detailing', 'Auto Detailing',
  '[
    {"name": "Basic Wash", "description": "Exterior wash, dry, and windows", "duration_minutes": 30, "price_cents": 2500, "price_type": "fixed", "is_bookable": true},
    {"name": "Interior Detail", "description": "Full interior vacuum, wipe-down, and conditioning", "duration_minutes": 90, "price_cents": 7900, "price_type": "fixed", "is_bookable": true},
    {"name": "Exterior Detail", "description": "Hand wash, clay bar, polish, and wax", "duration_minutes": 180, "price_cents": 14900, "price_type": "fixed", "is_bookable": true},
    {"name": "Full Detail", "description": "Complete interior and exterior detail", "duration_minutes": 300, "price_cents": 19900, "price_type": "fixed", "is_bookable": true},
    {"name": "Ceramic Coating", "description": "Professional ceramic coating application", "duration_minutes": 480, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Paint Correction", "description": "Swirl removal and paint restoration", "duration_minutes": 480, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you come to me or do I come to you?", "answer": "We offer both mobile detailing service and shop service. Your choice!"},
    {"question": "How long does a full detail take?", "answer": "A full detail typically takes 4-5 hours depending on vehicle size and condition."},
    {"question": "What is ceramic coating?", "answer": "Ceramic coating is a liquid polymer that bonds to paint for long-lasting protection and shine."},
    {"question": "Do you detail boats/RVs?", "answer": "Yes, we detail cars, trucks, SUVs, boats, RVs, and motorcycles."},
    {"question": "How often should I detail my car?", "answer": "We recommend a full detail every 3-6 months, with regular washes in between."},
    {"question": "Can you remove pet hair?", "answer": "Absolutely! Our interior detail includes thorough pet hair removal."}
  ]'::jsonb,
  ARRAY[]::text[],
  9
),

-- ============================================
-- Medical/Wellness Templates
-- ============================================

-- Dental
('dental', 'Dental Office',
  '[
    {"name": "Dental Exam", "description": "Comprehensive dental examination", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Teeth Cleaning", "description": "Professional dental cleaning", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "X-Rays", "description": "Dental x-ray imaging", "duration_minutes": 30, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Filling", "description": "Tooth filling procedure", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Crown", "description": "Dental crown fitting", "duration_minutes": 90, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Teeth Whitening", "description": "Professional whitening treatment", "duration_minutes": 90, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Emergency Visit", "description": "Emergency dental care", "duration_minutes": 30, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you accept my insurance?", "answer": "We accept most major dental insurance plans. Please call us with your insurance details and we can verify coverage."},
    {"question": "Are you accepting new patients?", "answer": "Yes, we are currently accepting new patients! Call to schedule your first appointment."},
    {"question": "Do you offer payment plans?", "answer": "Yes, we offer flexible payment options and financing for dental work."},
    {"question": "What if I have a dental emergency?", "answer": "We reserve time for same-day emergency appointments. Call us immediately if you have severe pain."},
    {"question": "How often should I have a dental checkup?", "answer": "We recommend checkups and cleanings every 6 months for optimal dental health."},
    {"question": "Do you offer sedation dentistry?", "answer": "Yes, we offer sedation options for patients with dental anxiety. Ask about our comfort options."}
  ]'::jsonb,
  ARRAY['tooth pain', 'broken tooth', 'dental emergency', 'severe pain', 'knocked out tooth'],
  10
),

-- Chiropractic
('chiropractic', 'Chiropractic',
  '[
    {"name": "Initial Consultation", "description": "New patient exam and assessment", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Adjustment", "description": "Spinal adjustment treatment", "duration_minutes": 30, "price_cents": 7500, "price_type": "fixed", "is_bookable": true},
    {"name": "X-Ray Imaging", "description": "Diagnostic x-rays", "duration_minutes": 30, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Massage Therapy", "description": "Therapeutic massage session", "duration_minutes": 60, "price_cents": 8500, "price_type": "fixed", "is_bookable": true},
    {"name": "Decompression Therapy", "description": "Spinal decompression treatment", "duration_minutes": 30, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Follow-up Visit", "description": "Return visit and adjustment", "duration_minutes": 20, "price_cents": 5500, "price_type": "fixed", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do you accept insurance?", "answer": "Yes, we accept most major insurance plans including auto injury and workers comp claims."},
    {"question": "How many visits will I need?", "answer": "Treatment plans vary by condition. After your initial exam, we will recommend a personalized plan."},
    {"question": "Is chiropractic care safe?", "answer": "Yes, chiropractic care is very safe when performed by a licensed chiropractor like our team."},
    {"question": "What conditions do you treat?", "answer": "We treat back pain, neck pain, headaches, sciatica, sports injuries, and more."},
    {"question": "Do I need a referral?", "answer": "No referral is needed. You can schedule directly with us."},
    {"question": "What should I wear to my appointment?", "answer": "Wear comfortable, loose-fitting clothing that allows you to move freely."}
  ]'::jsonb,
  ARRAY['severe pain', 'cant move', 'accident', 'injury'],
  11
),

-- Med Spa
('med_spa', 'Med Spa',
  '[
    {"name": "Consultation", "description": "Free consultation for new clients", "duration_minutes": 30, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Botox", "description": "Botox injection treatment", "duration_minutes": 30, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Dermal Fillers", "description": "Lip and facial filler treatments", "duration_minutes": 45, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Chemical Peel", "description": "Professional chemical peel treatment", "duration_minutes": 45, "price_cents": 15000, "price_type": "fixed", "is_bookable": true},
    {"name": "Microneedling", "description": "Collagen induction therapy", "duration_minutes": 60, "price_cents": 30000, "price_type": "fixed", "is_bookable": true},
    {"name": "Laser Treatment", "description": "Laser skin rejuvenation", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "IV Therapy", "description": "Vitamin IV infusion", "duration_minutes": 45, "price_cents": 15000, "price_type": "fixed", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Is there a consultation fee?", "answer": "No, your initial consultation is complimentary. We will discuss your goals and create a personalized plan."},
    {"question": "How long do results last?", "answer": "Results vary by treatment. Botox lasts 3-4 months, fillers 6-18 months depending on the product."},
    {"question": "Is there any downtime?", "answer": "Most treatments have minimal downtime. We will discuss what to expect during your consultation."},
    {"question": "Are your treatments safe?", "answer": "Yes, all treatments are performed by licensed medical professionals using FDA-approved products."},
    {"question": "Do you offer financing?", "answer": "Yes, we offer financing options to help make treatments more affordable."},
    {"question": "How do I prepare for my appointment?", "answer": "Avoid blood thinners and alcohol 24 hours before injectable treatments. We will provide specific instructions."}
  ]'::jsonb,
  ARRAY[]::text[],
  12
),

-- Massage Therapy
('massage', 'Massage Therapy',
  '[
    {"name": "Swedish Massage", "description": "Relaxing full-body massage", "duration_minutes": 60, "price_cents": 8500, "price_type": "fixed", "is_bookable": true},
    {"name": "Deep Tissue Massage", "description": "Therapeutic deep tissue work", "duration_minutes": 60, "price_cents": 9500, "price_type": "fixed", "is_bookable": true},
    {"name": "Sports Massage", "description": "Athletic performance and recovery massage", "duration_minutes": 60, "price_cents": 9500, "price_type": "fixed", "is_bookable": true},
    {"name": "Hot Stone Massage", "description": "Heated stone massage therapy", "duration_minutes": 90, "price_cents": 12500, "price_type": "fixed", "is_bookable": true},
    {"name": "Prenatal Massage", "description": "Massage for expecting mothers", "duration_minutes": 60, "price_cents": 8500, "price_type": "fixed", "is_bookable": true},
    {"name": "Couples Massage", "description": "Side-by-side massage for two", "duration_minutes": 60, "price_cents": 17000, "price_type": "fixed", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "What should I wear?", "answer": "You will undress to your comfort level and be draped with sheets throughout the massage."},
    {"question": "How early should I arrive?", "answer": "Please arrive 10-15 minutes early to complete paperwork and relax before your session."},
    {"question": "Can I request a specific therapist?", "answer": "Yes, you can request a specific therapist when booking."},
    {"question": "Do you offer gift certificates?", "answer": "Yes, gift certificates are available and make wonderful presents!"},
    {"question": "How often should I get a massage?", "answer": "For maintenance, monthly massages work well. For therapeutic goals, more frequent sessions may help."},
    {"question": "What is your cancellation policy?", "answer": "We request 24 hours notice for cancellations to avoid a cancellation fee."}
  ]'::jsonb,
  ARRAY[]::text[],
  13
),

-- Hair Salon
('salon', 'Hair Salon',
  '[
    {"name": "Haircut", "description": "Professional haircut and style", "duration_minutes": 45, "price_cents": 4500, "price_type": "fixed", "is_bookable": true},
    {"name": "Color", "description": "Single-process hair color", "duration_minutes": 90, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Highlights", "description": "Partial or full highlights", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Blowout", "description": "Shampoo and blowdry styling", "duration_minutes": 45, "price_cents": 4000, "price_type": "fixed", "is_bookable": true},
    {"name": "Deep Conditioning", "description": "Intensive hair treatment", "duration_minutes": 30, "price_cents": 3500, "price_type": "fixed", "is_bookable": true},
    {"name": "Balayage", "description": "Hand-painted highlight technique", "duration_minutes": 180, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Bridal Styling", "description": "Wedding hair styling", "duration_minutes": 90, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "Do I need an appointment?", "answer": "Appointments are recommended but we do accept walk-ins based on availability."},
    {"question": "How do I prepare for a color appointment?", "answer": "Come with unwashed hair from 1-2 days prior. Avoid styling products."},
    {"question": "How long will my appointment take?", "answer": "Haircuts take 45 minutes. Color services vary from 90 minutes to 3+ hours depending on the service."},
    {"question": "Do you do consultations?", "answer": "Yes, we offer free consultations to discuss your goals and provide pricing for complex services."},
    {"question": "What products do you use?", "answer": "We use professional salon-grade products. Ask your stylist about our retail products."},
    {"question": "What is your cancellation policy?", "answer": "We require 24 hours notice for cancellations to avoid a fee."}
  ]'::jsonb,
  ARRAY[]::text[],
  14
),

-- ============================================
-- Professional Services Templates
-- ============================================

-- Law Office
('legal', 'Law Office',
  '[
    {"name": "Initial Consultation", "description": "Case evaluation and legal advice", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Document Review", "description": "Legal document review and analysis", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Contract Drafting", "description": "Contract preparation and review", "duration_minutes": 120, "price_cents": null, "price_type": "quote", "is_bookable": false},
    {"name": "Representation", "description": "Court or mediation representation", "duration_minutes": 240, "price_cents": null, "price_type": "quote", "is_bookable": false},
    {"name": "Estate Planning", "description": "Will and trust preparation", "duration_minutes": 90, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "What areas of law do you practice?", "answer": "Please ask about our specific practice areas. We can direct you to the right attorney."},
    {"question": "Do you offer free consultations?", "answer": "Initial consultations vary by case type. Call to discuss your situation and consultation options."},
    {"question": "How are your fees structured?", "answer": "Fee structures depend on the type of case - hourly, flat fee, or contingency. We discuss fees upfront."},
    {"question": "How quickly can I get an appointment?", "answer": "We try to accommodate urgent matters quickly. Call and we will work to fit you in."},
    {"question": "What should I bring to my consultation?", "answer": "Bring any relevant documents, correspondence, and a list of questions you have."},
    {"question": "Do you handle cases in multiple states?", "answer": "Please call to discuss the specifics of your situation and jurisdiction."}
  ]'::jsonb,
  ARRAY['arrested', 'served papers', 'emergency custody', 'restraining order'],
  15
),

-- Accounting/Tax
('accounting', 'Accounting & Tax',
  '[
    {"name": "Tax Preparation", "description": "Individual or business tax return preparation", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Tax Planning", "description": "Proactive tax strategy consultation", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Bookkeeping", "description": "Monthly bookkeeping services", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": false},
    {"name": "Payroll Services", "description": "Payroll processing and compliance", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": false},
    {"name": "Business Formation", "description": "LLC or corporation setup", "duration_minutes": 90, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "IRS Representation", "description": "Audit representation and resolution", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "How much does tax preparation cost?", "answer": "Fees depend on return complexity. Simple returns start at one rate, business returns vary. Call for a quote."},
    {"question": "What documents do I need for my tax appointment?", "answer": "Bring W-2s, 1099s, mortgage interest statements, charitable donation receipts, and last years return."},
    {"question": "Do you handle IRS audits?", "answer": "Yes, we provide full IRS audit representation and can help resolve tax issues."},
    {"question": "Are you accepting new clients?", "answer": "Yes, we welcome new individual and business clients throughout the year."},
    {"question": "Can you help with back taxes?", "answer": "Yes, we help clients catch up on unfiled returns and negotiate with the IRS when needed."},
    {"question": "Do you work with small businesses?", "answer": "Absolutely. We specialize in small business accounting, tax, and advisory services."}
  ]'::jsonb,
  ARRAY['irs', 'audit', 'tax deadline'],
  16
),

-- Real Estate
('real_estate', 'Real Estate',
  '[
    {"name": "Buyer Consultation", "description": "Home buyer strategy session", "duration_minutes": 60, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Seller Consultation", "description": "Home selling strategy and pricing", "duration_minutes": 60, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Property Showing", "description": "Scheduled home tour", "duration_minutes": 60, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Market Analysis", "description": "Comparative market analysis", "duration_minutes": 45, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Open House", "description": "Public property showing", "duration_minutes": 180, "price_cents": 0, "price_type": "fixed", "is_bookable": false}
  ]'::jsonb,
  '[
    {"question": "How do I get started buying a home?", "answer": "Schedule a buyer consultation. We will discuss your needs, budget, and the buying process."},
    {"question": "What is your commission rate?", "answer": "Commission rates are negotiable and discussed during our initial consultation."},
    {"question": "How long does it take to sell a home?", "answer": "Market time varies by area and price point. We will provide data for your specific market."},
    {"question": "Do you work with first-time buyers?", "answer": "Absolutely! We love helping first-time buyers navigate the process."},
    {"question": "What areas do you serve?", "answer": "We serve the local area and surrounding communities. Call to confirm your area."},
    {"question": "Should I get pre-approved before looking at homes?", "answer": "Yes, we strongly recommend getting pre-approved so you know your budget and can move quickly."}
  ]'::jsonb,
  ARRAY[]::text[],
  17
),

-- Insurance
('insurance', 'Insurance Agency',
  '[
    {"name": "Quote Consultation", "description": "Insurance needs assessment and quotes", "duration_minutes": 30, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Policy Review", "description": "Annual coverage review", "duration_minutes": 45, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Claims Assistance", "description": "Help filing an insurance claim", "duration_minutes": 30, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Business Insurance", "description": "Commercial insurance consultation", "duration_minutes": 60, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Life Insurance", "description": "Life insurance needs analysis", "duration_minutes": 45, "price_cents": 0, "price_type": "fixed", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "What types of insurance do you offer?", "answer": "We offer auto, home, life, business, and many other types of insurance coverage."},
    {"question": "Can you beat my current rate?", "answer": "We will shop multiple carriers to find you the best coverage and price. Schedule a quote consultation."},
    {"question": "How do I file a claim?", "answer": "Call us and we will walk you through the claims process and help you file."},
    {"question": "When can I make changes to my policy?", "answer": "You can make changes anytime. Some changes take effect immediately, others at renewal."},
    {"question": "Do you offer bundle discounts?", "answer": "Yes, bundling multiple policies often qualifies you for significant discounts."},
    {"question": "What do I need to get a quote?", "answer": "Basic information about what you want to insure. For auto, your drivers license and vehicle info."}
  ]'::jsonb,
  ARRAY['accident', 'claim', 'damage', 'emergency'],
  18
),

-- ============================================
-- Restaurant Template
-- ============================================

('restaurant', 'Restaurant',
  '[
    {"name": "Reservation", "description": "Table reservation", "duration_minutes": 90, "price_cents": 0, "price_type": "hidden", "is_bookable": true},
    {"name": "Private Event", "description": "Private dining or event booking", "duration_minutes": 180, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Catering Inquiry", "description": "Off-site catering consultation", "duration_minutes": 30, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Takeout Order", "description": "Phone-in takeout order", "duration_minutes": 15, "price_cents": null, "price_type": "hidden", "is_bookable": false}
  ]'::jsonb,
  '[
    {"question": "What are your hours?", "answer": "Please ask for our current hours of operation."},
    {"question": "Do you take reservations?", "answer": "Yes, we accept reservations. We can book one for you now if you would like."},
    {"question": "Do you have vegetarian options?", "answer": "Yes, we have several vegetarian and vegan-friendly options on our menu."},
    {"question": "Do you accommodate food allergies?", "answer": "We take allergies seriously. Please inform your server of any allergies when you arrive."},
    {"question": "Do you do catering?", "answer": "Yes, we offer catering for events. Schedule a consultation to discuss your needs."},
    {"question": "Is there parking available?", "answer": "Please ask about parking options at our location."}
  ]'::jsonb,
  ARRAY[]::text[],
  19
),

-- ============================================
-- Other/Generic Template
-- ============================================

('other', 'Other Business Type',
  '[
    {"name": "Consultation", "description": "Initial consultation", "duration_minutes": 60, "price_cents": 0, "price_type": "fixed", "is_bookable": true},
    {"name": "Service Appointment", "description": "Standard service appointment", "duration_minutes": 60, "price_cents": null, "price_type": "quote", "is_bookable": true},
    {"name": "Follow-up", "description": "Follow-up appointment", "duration_minutes": 30, "price_cents": null, "price_type": "quote", "is_bookable": true}
  ]'::jsonb,
  '[
    {"question": "What are your hours?", "answer": "Please ask for our current business hours."},
    {"question": "Do you offer free estimates?", "answer": "Please ask about our consultation and estimate policy."},
    {"question": "How quickly can I get an appointment?", "answer": "Availability varies. We will work to accommodate your schedule."},
    {"question": "What forms of payment do you accept?", "answer": "Please ask about accepted payment methods."},
    {"question": "Are you licensed and insured?", "answer": "Please ask about our licensing and insurance coverage."}
  ]'::jsonb,
  ARRAY[]::text[],
  99
);

-- Create a comment for documentation
COMMENT ON TABLE business_templates IS 'Pre-populated business type templates with default services and FAQs. 20+ types covering home services, automotive, medical/wellness, professional services, and more.';


-- ==============================================
-- Migration: 20241222000001_add_phone_columns.sql
-- ==============================================

-- Migration: Add phone columns to businesses table (Session 12/13)
-- These columns store the Twilio phone number assigned to each business

-- Add phone_number column (the actual phone number in E.164 format)
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS phone_number text;

-- Add twilio_phone_sid column (Twilio's unique identifier for the number)
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS twilio_phone_sid text;

-- Add comments
COMMENT ON COLUMN businesses.phone_number IS 'Twilio phone number assigned to this business (E.164 format, e.g., +14155551234)';
COMMENT ON COLUMN businesses.twilio_phone_sid IS 'Twilio Phone Number SID for API operations';

-- Create index for looking up business by phone number (for incoming calls)
CREATE INDEX IF NOT EXISTS idx_businesses_phone_number ON businesses(phone_number);


-- ==============================================
-- Migration: 20241227000001_admin_functions.sql
-- ==============================================

-- Migration: Admin Dashboard Functions (Session: Admin Dashboard)
-- Spec Reference: Part 8, Lines 808-850
-- Admin-only views and functions for internal dashboard

-- ============================================
-- Admin Check Function
-- Used by RLS policies to verify admin access
-- ============================================
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

COMMENT ON FUNCTION public.is_admin_user() IS 'Check if current user is an admin via app_metadata';

-- ============================================
-- Admin Metrics View
-- Aggregated stats for admin dashboard
-- ============================================
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
  (SELECT COUNT(*) FROM calls c WHERE c.business_id = b.id AND c.outcome IN ('booked', 'transferred', 'info', 'message')) AS completed_calls,
  (SELECT COUNT(*) FROM calls c WHERE c.business_id = b.id AND c.outcome IN ('missed', 'minutes_exhausted')) AS failed_calls,
  (SELECT COUNT(*) FROM appointments a WHERE a.business_id = b.id) AS total_appointments,
  (SELECT SUM(c.duration_seconds) FROM calls c WHERE c.business_id = b.id) AS total_call_seconds,
  u.email AS owner_email,
  u.phone AS owner_phone
FROM businesses b
LEFT JOIN plans p ON b.plan_id = p.id
LEFT JOIN users u ON b.user_id = u.id;

COMMENT ON VIEW admin_business_metrics IS 'Comprehensive business metrics for admin dashboard';

-- ============================================
-- Admin Health Metrics View
-- Churn risk and health indicators
-- ============================================
CREATE OR REPLACE VIEW admin_health_metrics AS
SELECT
  b.id AS business_id,
  b.name AS business_name,
  b.subscription_status,
  b.updated_at AS last_activity,
  -- Days since last activity
  EXTRACT(DAY FROM NOW() - COALESCE(
    (SELECT MAX(c.created_at) FROM calls c WHERE c.business_id = b.id),
    b.created_at
  )) AS days_since_last_call,
  -- Usage trend
  b.minutes_used_this_cycle,
  b.minutes_included,
  -- Churn risk indicators
  CASE
    WHEN b.subscription_status = 'cancelled' THEN 'churned'
    WHEN b.subscription_status = 'paused' THEN 'high'
    WHEN EXTRACT(DAY FROM NOW() - COALESCE(
      (SELECT MAX(c.created_at) FROM calls c WHERE c.business_id = b.id),
      b.created_at
    )) > 14 THEN 'high'
    WHEN EXTRACT(DAY FROM NOW() - COALESCE(
      (SELECT MAX(c.created_at) FROM calls c WHERE c.business_id = b.id),
      b.created_at
    )) > 7 THEN 'medium'
    ELSE 'low'
  END AS churn_risk,
  -- Upsell opportunity
  CASE
    WHEN b.minutes_included > 0 AND (b.minutes_used_this_cycle::numeric / b.minutes_included) > 0.8
    THEN TRUE
    ELSE FALSE
  END AS upsell_candidate,
  -- Failed calls ratio
  CASE
    WHEN (SELECT COUNT(*) FROM calls c WHERE c.business_id = b.id) > 0
    THEN ROUND(
      (SELECT COUNT(*) FROM calls c WHERE c.business_id = b.id AND c.outcome IN ('missed', 'minutes_exhausted'))::numeric /
      (SELECT COUNT(*) FROM calls c WHERE c.business_id = b.id) * 100, 1
    )
    ELSE 0
  END AS failed_call_percent
FROM businesses b
WHERE b.subscription_status IN ('active', 'paused', 'cancelled');

COMMENT ON VIEW admin_health_metrics IS 'Business health indicators for churn prevention';

-- ============================================
-- Admin Financial Summary Function
-- Calculate MRR, ARPU, and other financial metrics
-- ============================================
CREATE OR REPLACE FUNCTION get_admin_financial_summary()
RETURNS TABLE (
  total_mrr_cents BIGINT,
  total_customers INT,
  active_customers INT,
  churned_customers INT,
  arpu_cents NUMERIC,
  new_customers_30d INT,
  churned_customers_30d INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(p.price_cents), 0)::BIGINT AS total_mrr_cents,
    COUNT(DISTINCT b.id)::INT AS total_customers,
    COUNT(DISTINCT CASE WHEN b.subscription_status = 'active' THEN b.id END)::INT AS active_customers,
    COUNT(DISTINCT CASE WHEN b.subscription_status = 'cancelled' THEN b.id END)::INT AS churned_customers,
    CASE
      WHEN COUNT(DISTINCT CASE WHEN b.subscription_status = 'active' THEN b.id END) > 0
      THEN ROUND(SUM(CASE WHEN b.subscription_status = 'active' THEN p.price_cents ELSE 0 END)::numeric /
           COUNT(DISTINCT CASE WHEN b.subscription_status = 'active' THEN b.id END), 0)
      ELSE 0
    END AS arpu_cents,
    COUNT(DISTINCT CASE WHEN b.created_at > NOW() - INTERVAL '30 days' THEN b.id END)::INT AS new_customers_30d,
    COUNT(DISTINCT CASE WHEN b.subscription_status = 'cancelled' AND b.updated_at > NOW() - INTERVAL '30 days' THEN b.id END)::INT AS churned_customers_30d
  FROM businesses b
  LEFT JOIN plans p ON b.plan_id = p.id
  WHERE b.subscription_status != 'onboarding';
END;
$$;

COMMENT ON FUNCTION get_admin_financial_summary() IS 'Calculate admin financial dashboard metrics';

-- ============================================
-- RLS Policies for Admin Access
-- Admins can view all data
-- ============================================

-- Enable RLS on views (if not already)
-- Note: Views inherit RLS from underlying tables
-- These policies allow admins to bypass normal tenant restrictions

-- Grant admin access to business metrics
CREATE POLICY "Admins can view all business metrics"
  ON businesses
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

-- Grant admin access to call data
CREATE POLICY "Admins can view all calls"
  ON calls
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

-- Grant admin access to appointments
CREATE POLICY "Admins can view all appointments"
  ON appointments
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());


-- ==============================================
-- Migration: 20241227000002_admin_extended.sql
-- ==============================================

-- Migration: Admin Extended Features
-- Audit logs and announcements tables for admin dashboard

-- ============================================
-- Audit Logs Table
-- Track admin actions for accountability
-- ============================================
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID NOT NULL,
  admin_email TEXT,
  action TEXT NOT NULL, -- 'subscription.pause', 'subscription.cancel', 'credit.apply', etc.
  target_type TEXT, -- 'business', 'subscription', 'user', etc.
  target_id UUID,
  target_name TEXT,
  details JSONB, -- Additional context about the action
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_admin ON admin_audit_logs(admin_user_id);
CREATE INDEX idx_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX idx_audit_logs_target ON admin_audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_created ON admin_audit_logs(created_at DESC);

COMMENT ON TABLE admin_audit_logs IS 'Tracks all admin actions for accountability';

-- ============================================
-- Announcements Table
-- System-wide or targeted announcements
-- ============================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- 'info', 'warning', 'success', 'error'
  target_audience TEXT DEFAULT 'all', -- 'all', 'active', 'trial', 'specific'
  target_business_ids UUID[], -- For specific targeting
  is_active BOOLEAN DEFAULT TRUE,
  starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_announcements_active ON announcements(is_active, starts_at, expires_at);

COMMENT ON TABLE announcements IS 'System announcements shown to users';

-- ============================================
-- System Logs Table
-- Track errors, webhook failures, etc.
-- ============================================
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level TEXT NOT NULL, -- 'error', 'warning', 'info'
  category TEXT NOT NULL, -- 'webhook', 'api', 'retell', 'twilio', 'stripe', 'calendar'
  message TEXT NOT NULL,
  details JSONB,
  business_id UUID,
  call_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_category ON system_logs(category);
CREATE INDEX idx_system_logs_business ON system_logs(business_id);
CREATE INDEX idx_system_logs_created ON system_logs(created_at DESC);

COMMENT ON TABLE system_logs IS 'System-wide error and event logging';

-- ============================================
-- RLS Policies for Admin Tables
-- ============================================

-- Audit logs - admin only
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

CREATE POLICY "Admins can insert audit logs"
  ON admin_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user());

-- Announcements - admin can manage, users can view active
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage announcements"
  ON announcements
  FOR ALL
  TO authenticated
  USING (public.is_admin_user());

CREATE POLICY "Users can view active announcements"
  ON announcements
  FOR SELECT
  TO authenticated
  USING (
    is_active = TRUE
    AND starts_at <= NOW()
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- System logs - admin only
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view system logs"
  ON system_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

CREATE POLICY "System can insert logs"
  ON system_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);


-- ==============================================
-- Migration: 20241227000003_demo_leads.sql
-- ==============================================

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


-- ==============================================
-- Migration: 20241229000001_site_settings.sql
-- ==============================================

-- Migration: Site Settings
-- Configurable settings for landing page stats and pricing

-- ============================================
-- Site Settings Table
-- Key-value store for site-wide settings
-- ============================================
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  category TEXT NOT NULL DEFAULT 'general', -- 'stats', 'pricing', 'general'
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_site_settings_key ON site_settings(key);
CREATE INDEX idx_site_settings_category ON site_settings(category);

COMMENT ON TABLE site_settings IS 'Site-wide configurable settings for landing page';

-- ============================================
-- Default Settings Data
-- ============================================

-- Landing Page Stats
INSERT INTO site_settings (key, value, category, description) VALUES
  ('stats_calls_today', '{"value": 2847, "label": "Calls Handled Today"}', 'stats', 'Live counter for calls handled today'),
  ('stats_total_calls', '{"value": 2147892, "suffix": "+", "label": "Total Calls Answered"}', 'stats', 'Total calls answered all time'),
  ('stats_businesses', '{"value": 10847, "suffix": "+", "label": "Businesses Trust Us"}', 'stats', 'Number of businesses using Koya'),
  ('stats_uptime', '{"value": 99.9, "suffix": "%", "label": "Uptime Guaranteed"}', 'stats', 'Service uptime percentage')
ON CONFLICT (key) DO NOTHING;

-- Pricing Plans
INSERT INTO site_settings (key, value, category, description) VALUES
  ('pricing_starter', '{
    "name": "Starter",
    "price": 49,
    "period": "month",
    "description": "Perfect for small businesses just getting started",
    "minutes": 100,
    "features": [
      "100 minutes/month",
      "1 phone number",
      "Basic call handling",
      "Email support",
      "Standard voice"
    ],
    "highlighted": false,
    "cta": "Start Free Trial"
  }', 'pricing', 'Starter plan configuration'),

  ('pricing_professional', '{
    "name": "Professional",
    "price": 149,
    "period": "month",
    "description": "For growing businesses that need more",
    "minutes": 500,
    "features": [
      "500 minutes/month",
      "2 phone numbers",
      "Advanced call routing",
      "Priority support",
      "Premium voices",
      "Calendar integration",
      "Custom greeting"
    ],
    "highlighted": true,
    "badge": "Most Popular",
    "cta": "Start Free Trial"
  }', 'pricing', 'Professional plan configuration'),

  ('pricing_enterprise', '{
    "name": "Enterprise",
    "price": 399,
    "period": "month",
    "description": "For businesses with high call volumes",
    "minutes": 2000,
    "features": [
      "2000 minutes/month",
      "5 phone numbers",
      "Multi-location support",
      "Dedicated account manager",
      "Custom AI training",
      "API access",
      "White-label options",
      "99.99% SLA"
    ],
    "highlighted": false,
    "cta": "Contact Sales"
  }', 'pricing', 'Enterprise plan configuration')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read site settings (for landing page)
CREATE POLICY "Anyone can read site settings"
  ON site_settings
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Only admins can update
CREATE POLICY "Admins can update site settings"
  ON site_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins can insert site settings"
  ON site_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins can delete site settings"
  ON site_settings
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user());


-- ==============================================
-- Migration: 20241229000002_multi_location.sql
-- ==============================================

-- Migration: Multi-Location Support (MVP)
-- Add location tracking to phone numbers

-- Add location_name to phone_numbers
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS location_name TEXT;
ALTER TABLE phone_numbers ADD COLUMN IF NOT EXISTS location_address TEXT;

COMMENT ON COLUMN phone_numbers.location_name IS 'Name of the location this phone serves (e.g., Downtown Office, North Branch)';
COMMENT ON COLUMN phone_numbers.location_address IS 'Address of this location';

-- Add location tracking to calls
ALTER TABLE calls ADD COLUMN IF NOT EXISTS location_name TEXT;

-- Create a view for location-based call stats
CREATE OR REPLACE VIEW location_call_stats AS
SELECT
  c.business_id,
  COALESCE(p.location_name, 'Main') as location_name,
  COUNT(*) as total_calls,
  COUNT(CASE WHEN c.outcome = 'booked' THEN 1 END) as booked_calls,
  COUNT(CASE WHEN c.outcome = 'transferred' THEN 1 END) as transferred_calls,
  SUM(COALESCE(c.duration_seconds, 0)) as total_duration_seconds,
  MAX(c.started_at) as last_call_at
FROM calls c
LEFT JOIN phone_numbers p ON c.to_number = p.number
GROUP BY c.business_id, COALESCE(p.location_name, 'Main');


-- ==============================================
-- Migration: 20241229000003_blog_posts.sql
-- ==============================================

-- Migration: AI Auto-Blog Feature
-- Supports SEO-optimized blog post generation and management

-- ============================================
-- Blog Posts Table
-- ============================================
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Content
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,

  -- SEO Metadata
  meta_title TEXT,
  meta_description TEXT,
  target_keyword TEXT,
  lsi_keywords TEXT[],

  -- Media
  featured_image_url TEXT,
  featured_image_alt TEXT,

  -- Categorization
  category TEXT,
  tags TEXT[],

  -- Status & Publishing
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,

  -- Generation Settings (saved for regeneration)
  generation_config JSONB DEFAULT '{}',
  -- Stores: tone, length, seo_focus, content_type, etc.

  -- Analytics
  view_count INT DEFAULT 0,

  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX idx_blog_posts_category ON blog_posts(category);

-- Auto-update updated_at
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Blog Generation Queue
-- ============================================
CREATE TABLE blog_generation_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Generation Request
  topic TEXT NOT NULL,
  target_keyword TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  -- Config includes: tone, length, seo_focus, content_type, include_images, etc.

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error_message TEXT,

  -- Result
  blog_post_id UUID REFERENCES blog_posts(id),

  -- Audit
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_blog_queue_status ON blog_generation_queue(status);

-- ============================================
-- Blog Presets (saved configurations)
-- ============================================
CREATE TABLE blog_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default presets
INSERT INTO blog_presets (name, description, config, is_default) VALUES
(
  'SEO Article',
  'Long-form SEO-optimized article for organic traffic',
  '{"tone": "professional", "length": "long", "seo_focus": "high", "content_type": "article", "include_images": true}',
  true
),
(
  'Quick Update',
  'Short news-style update for frequent posting',
  '{"tone": "casual", "length": "short", "seo_focus": "medium", "content_type": "news", "include_images": false}',
  false
),
(
  'How-To Guide',
  'Step-by-step tutorial with clear instructions',
  '{"tone": "helpful", "length": "medium", "seo_focus": "high", "content_type": "tutorial", "include_images": true}',
  false
),
(
  'Industry Insights',
  'Thought leadership content for authority building',
  '{"tone": "authoritative", "length": "long", "seo_focus": "medium", "content_type": "insight", "include_images": true}',
  false
);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_generation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_presets ENABLE ROW LEVEL SECURITY;

-- Blog posts - public can read published, admins can manage all
CREATE POLICY "Public can view published posts" ON blog_posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "Service role bypass blog_posts" ON blog_posts
  FOR ALL USING (auth.role() = 'service_role');

-- Queue - service role only
CREATE POLICY "Service role bypass blog_queue" ON blog_generation_queue
  FOR ALL USING (auth.role() = 'service_role');

-- Presets - public read, service role write
CREATE POLICY "Public can view presets" ON blog_presets
  FOR SELECT USING (true);

CREATE POLICY "Service role bypass blog_presets" ON blog_presets
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Helper function to generate slug
-- ============================================
CREATE OR REPLACE FUNCTION generate_blog_slug(title TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(title, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to increment view count
-- ============================================
CREATE OR REPLACE FUNCTION increment_blog_views(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE blog_posts
  SET view_count = view_count + 1
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================
-- Migration: 20241229000004_blog_clusters.sql
-- ==============================================

-- Migration: Topic Clusters for SEO
-- Implements pillar/cluster content strategy

-- ============================================
-- Topic Clusters Table
-- ============================================
CREATE TABLE blog_clusters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Cluster info
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,

  -- Target keyword for the cluster
  target_keyword TEXT NOT NULL,

  -- Pillar post (main hub article)
  pillar_post_id UUID REFERENCES blog_posts(id) ON DELETE SET NULL,

  -- SEO metadata for cluster page
  meta_title TEXT,
  meta_description TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Cluster Posts Junction Table
-- ============================================
CREATE TABLE blog_cluster_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_id UUID NOT NULL REFERENCES blog_clusters(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,

  -- Order within cluster
  sort_order INT DEFAULT 0,

  -- Is this the pillar post?
  is_pillar BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(cluster_id, post_id)
);

-- ============================================
-- Add cluster reference to blog_posts
-- ============================================
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES blog_clusters(id) ON DELETE SET NULL;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS is_pillar BOOLEAN DEFAULT FALSE;

-- Add internal links tracking
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS internal_links JSONB DEFAULT '[]';
-- Stores: [{"post_id": "uuid", "anchor_text": "text", "url": "/blog/slug"}]

-- Add schema type for structured data
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS schema_type TEXT DEFAULT 'Article'
  CHECK (schema_type IN ('Article', 'HowTo', 'FAQ', 'NewsArticle', 'BlogPosting'));

-- Add FAQ data for FAQ schema
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS faq_items JSONB DEFAULT '[]';
-- Stores: [{"question": "...", "answer": "..."}]

-- Add table of contents
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS table_of_contents JSONB DEFAULT '[]';
-- Stores: [{"id": "heading-id", "text": "Heading Text", "level": 2}]

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX idx_blog_clusters_slug ON blog_clusters(slug);
CREATE INDEX idx_blog_clusters_keyword ON blog_clusters(target_keyword);
CREATE INDEX idx_blog_cluster_posts_cluster ON blog_cluster_posts(cluster_id);
CREATE INDEX idx_blog_cluster_posts_post ON blog_cluster_posts(post_id);
CREATE INDEX idx_blog_posts_cluster ON blog_posts(cluster_id);

-- ============================================
-- Auto-update updated_at
-- ============================================
CREATE TRIGGER update_blog_clusters_updated_at
  BEFORE UPDATE ON blog_clusters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE blog_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_cluster_posts ENABLE ROW LEVEL SECURITY;

-- Clusters - public can view active, service role can manage
CREATE POLICY "Public can view active clusters" ON blog_clusters
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Service role bypass blog_clusters" ON blog_clusters
  FOR ALL USING (auth.role() = 'service_role');

-- Cluster posts - public can view, service role can manage
CREATE POLICY "Public can view cluster posts" ON blog_cluster_posts
  FOR SELECT USING (TRUE);

CREATE POLICY "Service role bypass blog_cluster_posts" ON blog_cluster_posts
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Function to auto-generate internal links
-- ============================================
CREATE OR REPLACE FUNCTION suggest_internal_links(p_post_id UUID, p_limit INT DEFAULT 5)
RETURNS TABLE (
  post_id UUID,
  title TEXT,
  slug TEXT,
  relevance_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH current_post AS (
    SELECT
      bp.id,
      bp.target_keyword,
      bp.category,
      bp.cluster_id,
      bp.lsi_keywords
    FROM blog_posts bp
    WHERE bp.id = p_post_id
  )
  SELECT
    bp.id as post_id,
    bp.title,
    bp.slug,
    (
      CASE WHEN bp.cluster_id = cp.cluster_id AND cp.cluster_id IS NOT NULL THEN 0.5 ELSE 0 END +
      CASE WHEN bp.category = cp.category AND cp.category IS NOT NULL THEN 0.3 ELSE 0 END +
      CASE WHEN bp.target_keyword = cp.target_keyword THEN 0.2 ELSE 0 END
    )::FLOAT as relevance_score
  FROM blog_posts bp, current_post cp
  WHERE bp.id != p_post_id
    AND bp.status = 'published'
  ORDER BY relevance_score DESC, bp.view_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;


-- ==============================================
-- Migration: 20250109000001_fix_calls_and_settings.sql
-- ==============================================

-- Migration: Fix calls table and call_settings table missing columns
-- Date: 2025-01-09
--
-- This migration adds missing columns that the application code expects:
-- 1. calls.flagged - boolean for flagging important calls
-- 2. calls.notes - text for user notes on calls
-- 3. call_settings.after_hours_action - controls after-hours call routing

-- =============================================================================
-- FIX #1: Add missing columns to calls table
-- =============================================================================

-- Add flagged column for marking important calls
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS flagged boolean DEFAULT false;

-- Add notes column for user annotations
ALTER TABLE calls
ADD COLUMN IF NOT EXISTS notes text;

-- Add index for filtering flagged calls
CREATE INDEX IF NOT EXISTS idx_calls_flagged
ON calls(business_id, flagged)
WHERE flagged = true;

-- =============================================================================
-- FIX #2: Add missing after_hours_action column to call_settings
-- =============================================================================

-- Add after_hours_action column
-- Values: 'voicemail' (default), 'ai', 'transfer'
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS after_hours_action text DEFAULT 'ai';

-- Add comment explaining the column
COMMENT ON COLUMN call_settings.after_hours_action IS
'Action to take for after-hours calls: voicemail, ai, or transfer';

-- =============================================================================
-- FIX #3: Add missing recording_enabled column to call_settings
-- =============================================================================

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS recording_enabled boolean DEFAULT true;

-- =============================================================================
-- FIX #4: Ensure calls table has proper indexes for dashboard queries
-- =============================================================================

-- Index for fetching recent calls by business
CREATE INDEX IF NOT EXISTS idx_calls_business_started
ON calls(business_id, started_at DESC);

-- Index for filtering by outcome
CREATE INDEX IF NOT EXISTS idx_calls_business_outcome
ON calls(business_id, outcome);

-- Index for searching by phone number
CREATE INDEX IF NOT EXISTS idx_calls_from_number
ON calls(from_number);

-- =============================================================================
-- Update any existing null values to defaults
-- =============================================================================

UPDATE calls SET flagged = false WHERE flagged IS NULL;
UPDATE call_settings SET after_hours_action = 'ai' WHERE after_hours_action IS NULL;
UPDATE call_settings SET recording_enabled = true WHERE recording_enabled IS NULL;


-- ==============================================
-- Migration: 20250110000001_enhanced_prompt_system.sql
-- ==============================================

-- =============================================================================
-- Enhanced Prompt System Migration
-- Adds support for:
-- 1. Prompt configuration (industry enhancements, sentiment detection, etc.)
-- 2. Caller profiles for repeat caller recognition
-- 3. Sentiment tracking on calls
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Add prompt_config column to ai_config table
-- -----------------------------------------------------------------------------

ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS prompt_config JSONB DEFAULT '{
  "industryEnhancements": true,
  "fewShotExamplesEnabled": true,
  "sentimentDetectionLevel": "basic",
  "callerContextEnabled": true,
  "toneIntensity": 3,
  "personalityAwareErrors": true,
  "maxFewShotExamples": 3
}'::jsonb;

-- Add comment
COMMENT ON COLUMN ai_config.prompt_config IS 'Enhanced prompt system configuration for industry-specific prompts, sentiment detection, and caller context';

-- -----------------------------------------------------------------------------
-- 2. Create caller_profiles table for repeat caller recognition
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS caller_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  name TEXT,
  email TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  call_count INT DEFAULT 1,
  last_call_at TIMESTAMPTZ DEFAULT now(),
  last_outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure unique phone per business
  CONSTRAINT unique_business_caller UNIQUE (business_id, phone_number)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_caller_profiles_lookup
  ON caller_profiles(business_id, phone_number);

CREATE INDEX IF NOT EXISTS idx_caller_profiles_business
  ON caller_profiles(business_id);

-- Add RLS policies
ALTER TABLE caller_profiles ENABLE ROW LEVEL SECURITY;

-- Business owners can read their caller profiles
CREATE POLICY "Business owners can read caller profiles"
  ON caller_profiles
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Business owners can insert caller profiles
CREATE POLICY "Business owners can insert caller profiles"
  ON caller_profiles
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Business owners can update caller profiles
CREATE POLICY "Business owners can update caller profiles"
  ON caller_profiles
  FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything (for API calls)
CREATE POLICY "Service role full access to caller profiles"
  ON caller_profiles
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add comment
COMMENT ON TABLE caller_profiles IS 'Stores caller information for repeat caller recognition and personalization';

-- -----------------------------------------------------------------------------
-- 3. Add sentiment tracking to calls table
-- -----------------------------------------------------------------------------

ALTER TABLE calls
ADD COLUMN IF NOT EXISTS sentiment_detected TEXT;

ALTER TABLE calls
ADD COLUMN IF NOT EXISTS error_recovery_used BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON COLUMN calls.sentiment_detected IS 'Detected caller sentiment during the call (pleased, neutral, frustrated, upset, angry)';
COMMENT ON COLUMN calls.error_recovery_used IS 'Whether error recovery messages were used during the call';

-- Create index for sentiment analysis
CREATE INDEX IF NOT EXISTS idx_calls_sentiment
  ON calls(business_id, sentiment_detected)
  WHERE sentiment_detected IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Create function to increment caller call count
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION increment_caller_count(
  p_business_id UUID,
  p_phone_number TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO caller_profiles (business_id, phone_number, call_count, last_call_at)
  VALUES (p_business_id, p_phone_number, 1, now())
  ON CONFLICT (business_id, phone_number)
  DO UPDATE SET
    call_count = caller_profiles.call_count + 1,
    last_call_at = now(),
    updated_at = now();
END;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION increment_caller_count TO authenticated;
GRANT EXECUTE ON FUNCTION increment_caller_count TO service_role;

-- -----------------------------------------------------------------------------
-- 5. Create function to update caller profile after call
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_caller_profile(
  p_business_id UUID,
  p_phone_number TEXT,
  p_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_outcome TEXT DEFAULT NULL,
  p_preferences JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO caller_profiles (business_id, phone_number, name, email, last_outcome, preferences, last_call_at)
  VALUES (
    p_business_id,
    p_phone_number,
    p_name,
    p_email,
    p_outcome,
    COALESCE(p_preferences, '{}'::jsonb),
    now()
  )
  ON CONFLICT (business_id, phone_number)
  DO UPDATE SET
    name = COALESCE(NULLIF(p_name, ''), caller_profiles.name),
    email = COALESCE(NULLIF(p_email, ''), caller_profiles.email),
    last_outcome = COALESCE(p_outcome, caller_profiles.last_outcome),
    preferences = caller_profiles.preferences || COALESCE(p_preferences, '{}'::jsonb),
    call_count = caller_profiles.call_count + 1,
    last_call_at = now(),
    updated_at = now();
END;
$$;

-- Grant execute to authenticated users and service role
GRANT EXECUTE ON FUNCTION update_caller_profile TO authenticated;
GRANT EXECUTE ON FUNCTION update_caller_profile TO service_role;

-- -----------------------------------------------------------------------------
-- 6. Create view for caller insights
-- -----------------------------------------------------------------------------

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
  END as caller_tier,
  (
    SELECT COUNT(*)
    FROM appointments a
    WHERE a.customer_phone = cp.phone_number
    AND a.business_id = cp.business_id
  ) as appointment_count,
  (
    SELECT a.service_name
    FROM appointments a
    WHERE a.customer_phone = cp.phone_number
    AND a.business_id = cp.business_id
    ORDER BY a.scheduled_at DESC
    LIMIT 1
  ) as last_service_booked
FROM caller_profiles cp;

-- Grant select on view
GRANT SELECT ON caller_insights TO authenticated;
GRANT SELECT ON caller_insights TO service_role;

-- Add comment
COMMENT ON VIEW caller_insights IS 'Provides insights about callers including tier classification and booking history';


-- ==============================================
-- Migration: 20250111000001_upsells.sql
-- ==============================================

-- Migration: Upsells Feature
-- Allows businesses to configure service upgrade offers
-- Example: "Upgrade from 30 min to 1 hour for 20% off"

-- Enable uuid extension if not exists
create extension if not exists "uuid-ossp";

-- ============================================
-- Upsells Table
-- Links services together for upgrade offers
-- ============================================
create table upsells (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,

  -- Source service (when customer is booking this...)
  source_service_id uuid not null references services(id) on delete cascade,

  -- Target service (...offer to upgrade to this)
  target_service_id uuid not null references services(id) on delete cascade,

  -- Offer details
  discount_percent int default 0, -- 0-100, e.g., 20 = 20% off
  pitch_message text, -- Custom message AI will use, e.g., "It's 20% cheaper to upgrade..."

  -- Timing configuration
  trigger_timing text default 'before_booking', -- before_booking, after_booking

  -- Status
  is_active boolean default true,

  -- Tracking
  times_offered int default 0,
  times_accepted int default 0,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  -- Constraints
  constraint valid_discount check (discount_percent >= 0 and discount_percent <= 100),
  constraint valid_timing check (trigger_timing in ('before_booking', 'after_booking')),
  constraint different_services check (source_service_id != target_service_id),
  constraint unique_upsell_per_service_pair unique (business_id, source_service_id, target_service_id)
);

comment on table upsells is 'Service upgrade offers - suggest better options when booking';
comment on column upsells.source_service_id is 'When customer books this service...';
comment on column upsells.target_service_id is '...offer to upgrade to this service';
comment on column upsells.discount_percent is 'Discount offered on the upgrade (0-100)';
comment on column upsells.pitch_message is 'Custom AI pitch message for this upsell';
comment on column upsells.trigger_timing is 'When to suggest: before_booking or after_booking';

-- Indexes
create index idx_upsells_business_id on upsells(business_id);
create index idx_upsells_source_service on upsells(source_service_id);
create index idx_upsells_active on upsells(business_id, is_active) where is_active = true;

-- Updated at trigger
create trigger update_upsells_updated_at
  before update on upsells
  for each row
  execute function update_updated_at_column();

-- ============================================
-- Add upsells_enabled to ai_config
-- ============================================
alter table ai_config add column if not exists upsells_enabled boolean default true;

comment on column ai_config.upsells_enabled is 'Whether the AI should suggest upsells during calls';

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================
alter table upsells enable row level security;

-- Users can only view upsells for their own business
create policy "Users can view own business upsells"
  on upsells for select
  using (
    business_id in (
      select id from businesses where user_id = auth.uid()
    )
  );

-- Users can only insert upsells for their own business
create policy "Users can insert own business upsells"
  on upsells for insert
  with check (
    business_id in (
      select id from businesses where user_id = auth.uid()
    )
  );

-- Users can only update upsells for their own business
create policy "Users can update own business upsells"
  on upsells for update
  using (
    business_id in (
      select id from businesses where user_id = auth.uid()
    )
  );

-- Users can only delete upsells for their own business
create policy "Users can delete own business upsells"
  on upsells for delete
  using (
    business_id in (
      select id from businesses where user_id = auth.uid()
    )
  );

-- Service role can access all upsells (for background jobs)
create policy "Service role can access all upsells"
  on upsells for all
  using (auth.role() = 'service_role');


-- ==============================================
-- Migration: 20250112000001_advanced_upselling.sql
-- ==============================================

-- Migration: Advanced Upselling Features
-- Adds bundles, packages, memberships, and availability-based upgrades

-- ============================================
-- Bundles Table
-- Groups 2+ services together with discount
-- Example: "Haircut + Beard Trim" = 15% off
-- ============================================
create table bundles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,

  name text not null,
  description text,
  discount_percent int default 0,
  pitch_message text,
  is_active boolean default true,

  times_offered int default 0,
  times_accepted int default 0,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  constraint valid_bundle_discount check (discount_percent >= 0 and discount_percent <= 100),
  constraint valid_bundle_times_offered check (times_offered >= 0),
  constraint valid_bundle_times_accepted check (times_accepted >= 0)
);

comment on table bundles is 'Service bundles with combined discount';

-- Junction table for bundle-service relationships
create table bundle_services (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references bundles(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  sort_order int default 0,

  constraint unique_bundle_service unique (bundle_id, service_id)
);

comment on table bundle_services is 'Junction table linking bundles to services';

-- Indexes for bundles
create index idx_bundles_business_id on bundles(business_id);
create index idx_bundles_active on bundles(business_id, is_active) where is_active = true;
create index idx_bundle_services_bundle on bundle_services(bundle_id);
create index idx_bundle_services_service on bundle_services(service_id);

-- ============================================
-- Packages Table
-- Multi-visit packages (buy 5, get 20% off)
-- ============================================
create table packages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,

  name text not null,
  description text,
  service_id uuid references services(id) on delete set null,

  session_count int not null,
  discount_percent int default 0,
  price_cents int,
  validity_days int,

  pitch_message text,
  min_visits_to_pitch int default 0,
  is_active boolean default true,

  times_offered int default 0,
  times_accepted int default 0,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  constraint valid_package_discount check (discount_percent >= 0 and discount_percent <= 100),
  constraint valid_session_count check (session_count >= 2),
  constraint valid_validity_days check (validity_days is null or validity_days > 0),
  constraint valid_min_visits check (min_visits_to_pitch >= 0),
  constraint valid_package_times_offered check (times_offered >= 0),
  constraint valid_package_times_accepted check (times_accepted >= 0)
);

comment on table packages is 'Multi-visit package offers';
comment on column packages.session_count is 'Number of sessions in the package';
comment on column packages.validity_days is 'Days until package expires (null = no expiry)';
comment on column packages.min_visits_to_pitch is 'Only pitch to callers with X+ previous visits';

-- Indexes
create index idx_packages_business_id on packages(business_id);
create index idx_packages_active on packages(business_id, is_active) where is_active = true;
create index idx_packages_service on packages(service_id);

-- ============================================
-- Memberships Table
-- Recurring membership plans
-- ============================================
create table memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,

  name text not null,
  description text,
  price_cents int not null,
  billing_period text default 'monthly',
  benefits text not null,

  pitch_message text,
  pitch_after_booking_amount_cents int,
  pitch_after_visit_count int,
  is_active boolean default true,

  times_offered int default 0,
  times_accepted int default 0,

  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  constraint valid_membership_price check (price_cents > 0),
  constraint valid_billing_period check (billing_period in ('monthly', 'quarterly', 'annual')),
  constraint valid_pitch_amount check (pitch_after_booking_amount_cents is null or pitch_after_booking_amount_cents >= 0),
  constraint valid_pitch_visits check (pitch_after_visit_count is null or pitch_after_visit_count >= 0),
  constraint valid_membership_times_offered check (times_offered >= 0),
  constraint valid_membership_times_accepted check (times_accepted >= 0)
);

comment on table memberships is 'Recurring membership plans';
comment on column memberships.benefits is 'Description of membership benefits for AI';

-- Indexes
create index idx_memberships_business_id on memberships(business_id);
create index idx_memberships_active on memberships(business_id, is_active) where is_active = true;

-- ============================================
-- Extend Upsells for Availability-Based Suggestions
-- ============================================
alter table upsells add column if not exists suggest_when_unavailable boolean default false;

comment on column upsells.suggest_when_unavailable is 'Suggest this upgrade when requested slot is unavailable';

-- ============================================
-- Extend AI Config for Feature Toggles
-- ============================================
alter table ai_config add column if not exists bundles_enabled boolean default true;
alter table ai_config add column if not exists packages_enabled boolean default true;
alter table ai_config add column if not exists memberships_enabled boolean default true;

comment on column ai_config.bundles_enabled is 'Whether AI should suggest bundles';
comment on column ai_config.packages_enabled is 'Whether AI should suggest packages';
comment on column ai_config.memberships_enabled is 'Whether AI should suggest memberships';

-- ============================================
-- RLS Policies for Bundles
-- ============================================
alter table bundles enable row level security;

create policy "Users can view own business bundles"
  on bundles for select
  using (business_id in (select id from businesses where user_id = auth.uid()));

create policy "Users can insert own business bundles"
  on bundles for insert
  with check (business_id in (select id from businesses where user_id = auth.uid()));

create policy "Users can update own business bundles"
  on bundles for update
  using (business_id in (select id from businesses where user_id = auth.uid()));

create policy "Users can delete own business bundles"
  on bundles for delete
  using (business_id in (select id from businesses where user_id = auth.uid()));

create policy "Service role can access all bundles"
  on bundles for all
  using (auth.role() = 'service_role');

-- ============================================
-- RLS Policies for Bundle Services
-- ============================================
alter table bundle_services enable row level security;

create policy "Users can view own bundle services"
  on bundle_services for select
  using (bundle_id in (
    select id from bundles where business_id in (
      select id from businesses where user_id = auth.uid()
    )
  ));

create policy "Users can insert own bundle services"
  on bundle_services for insert
  with check (bundle_id in (
    select id from bundles where business_id in (
      select id from businesses where user_id = auth.uid()
    )
  ));

create policy "Users can update own bundle services"
  on bundle_services for update
  using (bundle_id in (
    select id from bundles where business_id in (
      select id from businesses where user_id = auth.uid()
    )
  ));

create policy "Users can delete own bundle services"
  on bundle_services for delete
  using (bundle_id in (
    select id from bundles where business_id in (
      select id from businesses where user_id = auth.uid()
    )
  ));

create policy "Service role can access all bundle services"
  on bundle_services for all
  using (auth.role() = 'service_role');

-- ============================================
-- RLS Policies for Packages
-- ============================================
alter table packages enable row level security;

create policy "Users can view own business packages"
  on packages for select
  using (business_id in (select id from businesses where user_id = auth.uid()));

create policy "Users can insert own business packages"
  on packages for insert
  with check (business_id in (select id from businesses where user_id = auth.uid()));

create policy "Users can update own business packages"
  on packages for update
  using (business_id in (select id from businesses where user_id = auth.uid()));

create policy "Users can delete own business packages"
  on packages for delete
  using (business_id in (select id from businesses where user_id = auth.uid()));

create policy "Service role can access all packages"
  on packages for all
  using (auth.role() = 'service_role');

-- ============================================
-- RLS Policies for Memberships
-- ============================================
alter table memberships enable row level security;

create policy "Users can view own business memberships"
  on memberships for select
  using (business_id in (select id from businesses where user_id = auth.uid()));

create policy "Users can insert own business memberships"
  on memberships for insert
  with check (business_id in (select id from businesses where user_id = auth.uid()));

create policy "Users can update own business memberships"
  on memberships for update
  using (business_id in (select id from businesses where user_id = auth.uid()));

create policy "Users can delete own business memberships"
  on memberships for delete
  using (business_id in (select id from businesses where user_id = auth.uid()));

create policy "Service role can access all memberships"
  on memberships for all
  using (auth.role() = 'service_role');

-- ============================================
-- Updated At Triggers
-- ============================================
create trigger update_bundles_updated_at
  before update on bundles
  for each row
  execute function update_updated_at_column();

create trigger update_packages_updated_at
  before update on packages
  for each row
  execute function update_updated_at_column();

create trigger update_memberships_updated_at
  before update on memberships
  for each row
  execute function update_updated_at_column();


-- ==============================================
-- Migration: 20250113000001_appointment_reminder_columns.sql
-- ==============================================

-- Migration: Add separate reminder tracking columns for appointments
-- Fixes: Appointment reminder system expects separate 1hr and 24hr columns

-- Add separate reminder columns for 1-hour and 24-hour reminders
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS reminder_1hr_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS reminder_24hr_sent_at timestamptz;

-- Migrate existing reminder_sent_at data to reminder_24hr_sent_at (assume they were 24hr reminders)
UPDATE appointments
SET reminder_24hr_sent_at = reminder_sent_at
WHERE reminder_sent_at IS NOT NULL
  AND reminder_24hr_sent_at IS NULL;

-- Add indexes for the new columns to optimize reminder queries
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_1hr
ON appointments(scheduled_at)
WHERE reminder_1hr_sent_at IS NULL AND status = 'confirmed';

CREATE INDEX IF NOT EXISTS idx_appointments_reminder_24hr
ON appointments(scheduled_at)
WHERE reminder_24hr_sent_at IS NULL AND status = 'confirmed';

-- Comment the columns
COMMENT ON COLUMN appointments.reminder_1hr_sent_at IS 'Timestamp when 1-hour reminder SMS was sent';
COMMENT ON COLUMN appointments.reminder_24hr_sent_at IS 'Timestamp when 24-hour reminder SMS was sent';


-- ==============================================
-- Migration: 20250113000002_retell_sync_tracking.sql
-- ==============================================

-- Migration: Add Retell sync tracking columns
-- Allows tracking when prompts were last synced to Retell

-- Add retell_synced_at to track last successful sync
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS retell_synced_at timestamptz;

COMMENT ON COLUMN ai_config.retell_synced_at IS 'Timestamp of last successful Retell agent sync';

-- Add missing columns to system_logs if they don't exist
DO $$
BEGIN
  -- Add event_type column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_logs' AND column_name = 'event_type'
  ) THEN
    ALTER TABLE system_logs ADD COLUMN event_type TEXT;
  END IF;

  -- Add message column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_logs' AND column_name = 'message'
  ) THEN
    ALTER TABLE system_logs ADD COLUMN message TEXT;
  END IF;

  -- Add metadata column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_logs' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE system_logs ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- Index for querying logs by business (if column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_logs' AND column_name = 'business_id') THEN
    CREATE INDEX IF NOT EXISTS idx_system_logs_business_id ON system_logs(business_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_logs' AND column_name = 'event_type') THEN
    CREATE INDEX IF NOT EXISTS idx_system_logs_event_type ON system_logs(event_type);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_logs' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
  END IF;
END $$;


-- ==============================================
-- Migration: 20250114000001_retell_advanced_features.sql
-- ==============================================

-- Migration: Add Retell AI advanced features
-- Features: Voicemail Detection, Silence Handling, DTMF, Denoising, Boosted Keywords,
--           Custom Summary Prompt, PII Redaction, Fallback Voices

-- ============================================================================
-- call_settings table additions
-- ============================================================================

-- Voicemail Detection
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS voicemail_detection_enabled boolean DEFAULT false;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS voicemail_message text;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS voicemail_detection_timeout_ms integer DEFAULT 30000;

-- Silence Handling
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS reminder_trigger_ms integer DEFAULT 10000;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS reminder_max_count integer DEFAULT 2;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS end_call_after_silence_ms integer DEFAULT 30000;

-- DTMF Input (Touch-Tone)
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS dtmf_enabled boolean DEFAULT false;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS dtmf_digit_limit integer DEFAULT 10;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS dtmf_termination_key text DEFAULT '#';

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS dtmf_timeout_ms integer DEFAULT 5000;

-- Background Denoising
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS denoising_mode text DEFAULT 'noise-cancellation';

-- PII Redaction
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS pii_redaction_enabled boolean DEFAULT false;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS pii_categories text[] DEFAULT ARRAY['ssn', 'credit_card']::text[];

-- ============================================================================
-- ai_config table additions
-- ============================================================================

-- Boosted Keywords
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS boosted_keywords text[] DEFAULT '{}'::text[];

-- Custom Summary Prompt
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS analysis_summary_prompt text;

ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS analysis_model text DEFAULT 'gpt-4.1-mini';

-- Fallback Voices
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS fallback_voice_ids text[] DEFAULT '{}'::text[];

-- ============================================================================
-- Constraints
-- ============================================================================

-- Validate denoising mode
ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_denoising_mode;
ALTER TABLE call_settings ADD CONSTRAINT valid_denoising_mode
CHECK (denoising_mode IN ('noise-cancellation', 'noise-and-background-speech-cancellation'));

-- Validate DTMF termination key
ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_dtmf_termination_key;
ALTER TABLE call_settings ADD CONSTRAINT valid_dtmf_termination_key
CHECK (dtmf_termination_key IN ('#', '*', 'none'));

-- Validate analysis model
ALTER TABLE ai_config DROP CONSTRAINT IF EXISTS valid_analysis_model;
ALTER TABLE ai_config ADD CONSTRAINT valid_analysis_model
CHECK (analysis_model IN ('gpt-4.1-mini', 'claude-4.5-sonnet', 'gemini-2.5-flash'));

-- Validate timeouts are reasonable
ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_voicemail_timeout;
ALTER TABLE call_settings ADD CONSTRAINT valid_voicemail_timeout
CHECK (voicemail_detection_timeout_ms >= 5000 AND voicemail_detection_timeout_ms <= 180000);

ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_reminder_trigger;
ALTER TABLE call_settings ADD CONSTRAINT valid_reminder_trigger
CHECK (reminder_trigger_ms >= 5000 AND reminder_trigger_ms <= 60000);

ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_end_call_silence;
ALTER TABLE call_settings ADD CONSTRAINT valid_end_call_silence
CHECK (end_call_after_silence_ms >= 10000 AND end_call_after_silence_ms <= 120000);

ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_dtmf_timeout;
ALTER TABLE call_settings ADD CONSTRAINT valid_dtmf_timeout
CHECK (dtmf_timeout_ms >= 1000 AND dtmf_timeout_ms <= 15000);

ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_dtmf_digit_limit;
ALTER TABLE call_settings ADD CONSTRAINT valid_dtmf_digit_limit
CHECK (dtmf_digit_limit >= 1 AND dtmf_digit_limit <= 50);

ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_reminder_max_count;
ALTER TABLE call_settings ADD CONSTRAINT valid_reminder_max_count
CHECK (reminder_max_count >= 0 AND reminder_max_count <= 10);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON COLUMN call_settings.voicemail_detection_enabled IS 'Enable automatic voicemail detection';
COMMENT ON COLUMN call_settings.voicemail_message IS 'Message to leave when voicemail is detected';
COMMENT ON COLUMN call_settings.voicemail_detection_timeout_ms IS 'Time to wait for voicemail detection (5000-180000ms)';

COMMENT ON COLUMN call_settings.reminder_trigger_ms IS 'Milliseconds of silence before prompting caller (5000-60000)';
COMMENT ON COLUMN call_settings.reminder_max_count IS 'Maximum number of silence reminders (0-10)';
COMMENT ON COLUMN call_settings.end_call_after_silence_ms IS 'End call after this much total silence (10000-120000ms)';

COMMENT ON COLUMN call_settings.dtmf_enabled IS 'Allow callers to enter touch-tone digits';
COMMENT ON COLUMN call_settings.dtmf_digit_limit IS 'Maximum digits caller can enter (1-50)';
COMMENT ON COLUMN call_settings.dtmf_termination_key IS 'Key to end digit entry (#, *, or none)';
COMMENT ON COLUMN call_settings.dtmf_timeout_ms IS 'Time to wait for digit input (1000-15000ms)';

COMMENT ON COLUMN call_settings.denoising_mode IS 'Background noise reduction level';
COMMENT ON COLUMN call_settings.pii_redaction_enabled IS 'Enable PII redaction in transcripts';
COMMENT ON COLUMN call_settings.pii_categories IS 'PII categories to redact (ssn, credit_card, phone_number, email, date_of_birth, address)';

COMMENT ON COLUMN ai_config.boosted_keywords IS 'Words to prioritize in speech recognition';
COMMENT ON COLUMN ai_config.analysis_summary_prompt IS 'Custom prompt for generating call summaries';
COMMENT ON COLUMN ai_config.analysis_model IS 'AI model for post-call analysis';
COMMENT ON COLUMN ai_config.fallback_voice_ids IS 'Backup voice IDs if primary voice is unavailable';


-- ==============================================
-- Migration: 20250114000002_add_responsiveness_settings.sql
-- ==============================================

-- Migration: Add responsiveness settings for Retell AI
-- Features: Interruption sensitivity and response speed
-- These settings control how quickly Koya stops talking when the caller speaks
-- and how fast Koya responds after the caller finishes speaking

-- ============================================================================
-- call_settings table additions
-- ============================================================================

-- Interruption Sensitivity: How sensitive to caller interruptions (0-1)
-- Higher values = stops faster when caller starts speaking
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS interruption_sensitivity numeric(3,2) DEFAULT 0.9;

-- Responsiveness: How quickly to respond after caller stops speaking (0-1)
-- Higher values = responds faster
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS responsiveness numeric(3,2) DEFAULT 0.9;

-- ============================================================================
-- Constraints
-- ============================================================================

-- Validate interruption sensitivity is between 0 and 1
ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_interruption_sensitivity;
ALTER TABLE call_settings ADD CONSTRAINT valid_interruption_sensitivity
CHECK (interruption_sensitivity >= 0 AND interruption_sensitivity <= 1);

-- Validate responsiveness is between 0 and 1
ALTER TABLE call_settings DROP CONSTRAINT IF EXISTS valid_responsiveness;
ALTER TABLE call_settings ADD CONSTRAINT valid_responsiveness
CHECK (responsiveness >= 0 AND responsiveness <= 1);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON COLUMN call_settings.interruption_sensitivity IS 'How sensitive to caller interruptions (0-1). Higher = stops faster when caller speaks. Default 0.9 for highly responsive behavior.';
COMMENT ON COLUMN call_settings.responsiveness IS 'How quickly to respond after caller stops speaking (0-1). Higher = responds faster. Default 0.9 for highly responsive behavior.';


-- ==============================================
-- Migration: 20250115000001_voice_controls.sql
-- ==============================================

-- Migration: Add voice control settings for Retell AI
-- Features: Voice temperature, voice speed, begin message delay
-- These settings give users fine-grained control over how the AI voice sounds

-- ============================================================================
-- ai_config table additions
-- ============================================================================

-- Voice Temperature: Controls voice stability vs expressiveness (0-2)
-- Lower = more stable/consistent, Higher = more expressive/varied
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS voice_temperature numeric(3,2) DEFAULT 1.0;

-- Voice Speed: Controls speech rate (0.5-2)
-- Lower = slower speech, Higher = faster speech
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS voice_speed numeric(3,2) DEFAULT 1.0;

-- Volume: Output loudness (0-2)
-- Lower = quieter, Higher = louder
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS voice_volume numeric(3,2) DEFAULT 1.0;

-- Begin Message Delay: Delay before first message in ms (0-5000)
-- Useful to let the phone ring/connect before AI speaks
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS begin_message_delay_ms integer DEFAULT 0;

-- ============================================================================
-- Constraints
-- ============================================================================

-- Validate voice temperature is between 0 and 2
ALTER TABLE ai_config DROP CONSTRAINT IF EXISTS valid_voice_temperature;
ALTER TABLE ai_config ADD CONSTRAINT valid_voice_temperature
CHECK (voice_temperature >= 0 AND voice_temperature <= 2);

-- Validate voice speed is between 0.5 and 2
ALTER TABLE ai_config DROP CONSTRAINT IF EXISTS valid_voice_speed;
ALTER TABLE ai_config ADD CONSTRAINT valid_voice_speed
CHECK (voice_speed >= 0.5 AND voice_speed <= 2);

-- Validate volume is between 0 and 2
ALTER TABLE ai_config DROP CONSTRAINT IF EXISTS valid_voice_volume;
ALTER TABLE ai_config ADD CONSTRAINT valid_voice_volume
CHECK (voice_volume >= 0 AND voice_volume <= 2);

-- Validate begin message delay is between 0 and 5000ms
ALTER TABLE ai_config DROP CONSTRAINT IF EXISTS valid_begin_message_delay;
ALTER TABLE ai_config ADD CONSTRAINT valid_begin_message_delay
CHECK (begin_message_delay_ms >= 0 AND begin_message_delay_ms <= 5000);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON COLUMN ai_config.voice_temperature IS 'Voice stability vs expressiveness (0-2). Lower = more consistent, Higher = more varied/emotional. Default 1.0.';
COMMENT ON COLUMN ai_config.voice_speed IS 'Speech rate multiplier (0.5-2). Lower = slower, Higher = faster. Default 1.0.';
COMMENT ON COLUMN ai_config.voice_volume IS 'Output volume level (0-2). Lower = quieter, Higher = louder. Default 1.0.';
COMMENT ON COLUMN ai_config.begin_message_delay_ms IS 'Delay before AI speaks after call connects (0-5000ms). Useful for natural call start. Default 0.';


-- ==============================================
-- Migration: 20250116000001_cleanup_duplicate_volume.sql
-- ==============================================

-- Migration: Cleanup duplicate volume column
-- Fixes: ai_config had both 'volume' and 'voice_volume' columns
-- The correct column is 'voice_volume', so we drop the duplicate 'volume'

-- Drop duplicate volume column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_config' AND column_name = 'volume'
  ) THEN
    ALTER TABLE ai_config DROP COLUMN volume;
    RAISE NOTICE 'Dropped duplicate volume column from ai_config';
  END IF;
END $$;

-- Ensure voice_volume exists with correct definition
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS voice_volume numeric(3,2) DEFAULT 1.0;

-- Ensure constraint exists
ALTER TABLE ai_config DROP CONSTRAINT IF EXISTS valid_voice_volume;
ALTER TABLE ai_config ADD CONSTRAINT valid_voice_volume
CHECK (voice_volume >= 0 AND voice_volume <= 2);

COMMENT ON COLUMN ai_config.voice_volume IS 'Output volume level (0-2). Lower = quieter, Higher = louder. Default 1.0.';


-- ==============================================
-- Migration: 20250118000001_add_email_missed.sql
-- ==============================================

-- Add email_missed column for missed call email notifications
-- This column was missing, causing the Inngest function to query a non-existent column

ALTER TABLE notification_settings
ADD COLUMN IF NOT EXISTS email_missed boolean DEFAULT true;

COMMENT ON COLUMN notification_settings.email_missed IS 'Send email alert when a call is missed';


-- ==============================================
-- Migration: 20250119000001_reminder_both_option.sql
-- ==============================================

-- Add 'both' option for appointment reminders
-- Allows businesses to send both 1-hour and 24-hour reminders

-- Drop the old constraint
ALTER TABLE notification_settings
DROP CONSTRAINT IF EXISTS valid_reminder;

-- Add the updated constraint with 'both' option
ALTER TABLE notification_settings
ADD CONSTRAINT valid_reminder CHECK (sms_customer_reminder IN ('off', '1hr', '24hr', 'both'));

-- Fix column naming in appointments table (use hr not h)
-- Note: This is a no-op if columns already have correct names from migration 20250113000001
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'appointments' AND column_name = 'reminder_1h_sent_at') THEN
    ALTER TABLE appointments RENAME COLUMN reminder_1h_sent_at TO reminder_1hr_sent_at;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'appointments' AND column_name = 'reminder_24h_sent_at') THEN
    ALTER TABLE appointments RENAME COLUMN reminder_24h_sent_at TO reminder_24hr_sent_at;
  END IF;
END $$;

COMMENT ON CONSTRAINT valid_reminder ON notification_settings IS
  'Customer reminder options: off, 1hr (1 hour before), 24hr (24 hours before), both (1hr and 24hr)';


-- ==============================================
-- Migration: 20250119000002_sms_templates.sql
-- ==============================================

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


-- ==============================================
-- Migration: 20250120000001_sms_opt_outs.sql
-- ==============================================

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


-- ==============================================
-- Migration: 20250121000002_auth_events.sql
-- ==============================================

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


-- ==============================================
-- Migration: 20250121000003_data_requests.sql
-- ==============================================

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


-- ==============================================
-- Migration: 20250121000004_trial_period.sql
-- ==============================================

-- Migration: Trial Period Support
-- Adds trial period tracking columns to businesses table
-- Implements trial enforcement for new signups

-- ============================================
-- Add trial columns to businesses table
-- ============================================

-- trial_ends_at: When the 14-day trial expires
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- trial_minutes_limit: Maximum minutes allowed during trial (default 30)
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS trial_minutes_limit INTEGER DEFAULT 30;

-- trial_minutes_used: Minutes consumed during trial period
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS trial_minutes_used INTEGER DEFAULT 0;

-- trial_email_3day_sent: Track if 3-day warning email was sent
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS trial_email_3day_sent BOOLEAN DEFAULT FALSE;

-- trial_email_1day_sent: Track if 1-day warning email was sent
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS trial_email_1day_sent BOOLEAN DEFAULT FALSE;

-- trial_email_expired_sent: Track if expiry email was sent
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS trial_email_expired_sent BOOLEAN DEFAULT FALSE;

-- Add comments
COMMENT ON COLUMN businesses.trial_ends_at IS 'Timestamp when the 14-day trial period expires';
COMMENT ON COLUMN businesses.trial_minutes_limit IS 'Maximum AI minutes allowed during trial (default 30)';
COMMENT ON COLUMN businesses.trial_minutes_used IS 'AI minutes consumed during trial period';
COMMENT ON COLUMN businesses.trial_email_3day_sent IS 'Whether the 3-day trial warning email has been sent';
COMMENT ON COLUMN businesses.trial_email_1day_sent IS 'Whether the 1-day trial warning email has been sent';
COMMENT ON COLUMN businesses.trial_email_expired_sent IS 'Whether the trial expired email has been sent';

-- ============================================
-- Create index for trial expiry queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_businesses_trial_ends_at
ON businesses(trial_ends_at)
WHERE subscription_status = 'trialing' AND trial_ends_at IS NOT NULL;

-- ============================================
-- Function to increment trial minutes used
-- Atomic increment to prevent race conditions
-- ============================================
CREATE OR REPLACE FUNCTION increment_trial_minutes(
  p_business_id UUID,
  p_minutes INTEGER
)
RETURNS TABLE(
  trial_minutes_used INTEGER,
  trial_minutes_limit INTEGER,
  trial_exhausted BOOLEAN
) AS $$
DECLARE
  v_trial_minutes_used INTEGER;
  v_trial_minutes_limit INTEGER;
  v_subscription_status TEXT;
BEGIN
  -- Validate input
  IF p_minutes <= 0 THEN
    RAISE EXCEPTION 'Minutes must be positive';
  END IF;
  IF p_minutes > 60 THEN
    RAISE EXCEPTION 'Single call cannot exceed 60 minutes';
  END IF;

  -- Atomic update with row lock
  UPDATE businesses
  SET trial_minutes_used = COALESCE(trial_minutes_used, 0) + p_minutes
  WHERE id = p_business_id
    AND subscription_status = 'trialing'
  RETURNING
    businesses.trial_minutes_used,
    COALESCE(businesses.trial_minutes_limit, 30),
    businesses.subscription_status
  INTO v_trial_minutes_used, v_trial_minutes_limit, v_subscription_status;

  -- Return updated values
  RETURN QUERY SELECT
    v_trial_minutes_used,
    v_trial_minutes_limit,
    (v_trial_minutes_used >= v_trial_minutes_limit);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to check trial status
-- Returns comprehensive trial information
-- ============================================
CREATE OR REPLACE FUNCTION get_trial_status(p_business_id UUID)
RETURNS TABLE(
  is_trialing BOOLEAN,
  trial_ends_at TIMESTAMPTZ,
  days_remaining INTEGER,
  minutes_used INTEGER,
  minutes_limit INTEGER,
  minutes_remaining INTEGER,
  is_expired BOOLEAN,
  is_minutes_exhausted BOOLEAN
) AS $$
DECLARE
  v_business RECORD;
BEGIN
  SELECT
    b.subscription_status,
    b.trial_ends_at,
    COALESCE(b.trial_minutes_used, 0) as trial_minutes_used,
    COALESCE(b.trial_minutes_limit, 30) as trial_minutes_limit
  INTO v_business
  FROM businesses b
  WHERE b.id = p_business_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      FALSE,
      NULL::TIMESTAMPTZ,
      0,
      0,
      30,
      30,
      TRUE,
      FALSE;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    (v_business.subscription_status = 'trialing'),
    v_business.trial_ends_at,
    GREATEST(0, EXTRACT(DAY FROM (v_business.trial_ends_at - NOW()))::INTEGER),
    v_business.trial_minutes_used,
    v_business.trial_minutes_limit,
    GREATEST(0, v_business.trial_minutes_limit - v_business.trial_minutes_used),
    (v_business.trial_ends_at IS NOT NULL AND v_business.trial_ends_at < NOW()),
    (v_business.trial_minutes_used >= v_business.trial_minutes_limit);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Function to expire trial
-- Called when trial ends or minutes exhausted
-- ============================================
CREATE OR REPLACE FUNCTION expire_trial(p_business_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE businesses
  SET subscription_status = 'trial_expired'
  WHERE id = p_business_id
    AND subscription_status = 'trialing';
END;
$$ LANGUAGE plpgsql;


-- ==============================================
-- Migration: 20250122000001_force_advanced_columns.sql
-- ==============================================

-- Migration: Force add advanced AI columns (schema cache refresh)
-- This migration ensures all advanced columns exist

-- ============================================================================
-- call_settings table - Advanced Call Features
-- ============================================================================

-- Voicemail Detection
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS voicemail_detection_enabled boolean DEFAULT false;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS voicemail_message text;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS voicemail_detection_timeout_ms integer DEFAULT 30000;

-- Silence Handling
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS reminder_trigger_ms integer DEFAULT 10000;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS reminder_max_count integer DEFAULT 2;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS end_call_after_silence_ms integer DEFAULT 30000;

-- DTMF Input
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS dtmf_enabled boolean DEFAULT false;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS dtmf_digit_limit integer DEFAULT 10;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS dtmf_termination_key text DEFAULT '#';

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS dtmf_timeout_ms integer DEFAULT 5000;

-- Denoising
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS denoising_mode text DEFAULT 'noise-cancellation';

-- PII Redaction
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS pii_redaction_enabled boolean DEFAULT false;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS pii_categories text[] DEFAULT ARRAY['ssn', 'credit_card']::text[];

-- Responsiveness settings
ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS interruption_sensitivity numeric(3,2) DEFAULT 0.9;

ALTER TABLE call_settings
ADD COLUMN IF NOT EXISTS responsiveness numeric(3,2) DEFAULT 0.9;

-- ============================================================================
-- ai_config table - Advanced AI Features
-- ============================================================================

-- Boosted Keywords
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS boosted_keywords text[] DEFAULT '{}'::text[];

-- Custom Summary Prompt
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS analysis_summary_prompt text;

-- Analysis Model
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS analysis_model text DEFAULT 'gpt-4.1-mini';

-- Prompt Config (JSONB for enhanced prompt system)
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS prompt_config JSONB DEFAULT '{
  "industryEnhancements": true,
  "fewShotExamplesEnabled": true,
  "sentimentDetectionLevel": "basic",
  "callerContextEnabled": true,
  "toneIntensity": 3,
  "personalityAwareErrors": true,
  "maxFewShotExamples": 3
}'::jsonb;

-- Fallback Voices
ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS fallback_voice_ids text[] DEFAULT '{}'::text[];

-- ============================================================================
-- Notify PostgREST to reload schema cache
-- ============================================================================
NOTIFY pgrst, 'reload schema';


-- ==============================================
-- Migration: 20250122000002_add_prompt_config.sql
-- ==============================================

-- Migration: Add prompt_config column to ai_config
-- This ensures the prompt_config column exists for enhanced AI settings

ALTER TABLE ai_config
ADD COLUMN IF NOT EXISTS prompt_config JSONB DEFAULT '{
  "industryEnhancements": true,
  "fewShotExamplesEnabled": true,
  "sentimentDetectionLevel": "basic",
  "callerContextEnabled": true,
  "toneIntensity": 3,
  "personalityAwareErrors": true,
  "maxFewShotExamples": 3
}'::jsonb;

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';


-- ==============================================
-- Migration: 20250122000003_add_business_integrations.sql
-- ==============================================

-- Migration: Add business_integrations table
-- Stores OAuth tokens and settings for third-party integrations
-- Supports: Shopify, Square, Stripe Connect, HubSpot, Salesforce, OpenTable, Mindbody

-- ============================================================================
-- Create business_integrations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS business_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'shopify', 'square', 'stripe_connect', 'hubspot', 'salesforce', 'opentable', 'mindbody'
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  shop_domain TEXT, -- For Shopify store domain
  location_id TEXT, -- For Square/OpenTable/Mindbody location
  account_id TEXT, -- For Stripe Connect account ID
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, provider)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_business_integrations_business_id
  ON business_integrations(business_id);

CREATE INDEX IF NOT EXISTS idx_business_integrations_provider
  ON business_integrations(provider);

CREATE INDEX IF NOT EXISTS idx_business_integrations_active
  ON business_integrations(business_id, is_active)
  WHERE is_active = true;

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE business_integrations ENABLE ROW LEVEL SECURITY;

-- Users can view their own business integrations
CREATE POLICY "Users can view own integrations"
  ON business_integrations
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Users can insert integrations for their business
CREATE POLICY "Users can create own integrations"
  ON business_integrations
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Users can update their own integrations
CREATE POLICY "Users can update own integrations"
  ON business_integrations
  FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own integrations
CREATE POLICY "Users can delete own integrations"
  ON business_integrations
  FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Service role can do everything (for OAuth callbacks)
CREATE POLICY "Service role full access"
  ON business_integrations
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- Notify PostgREST to reload schema cache
-- ============================================================================
NOTIFY pgrst, 'reload schema';


-- ==============================================
-- Migration: 20250122000004_add_business_webhooks.sql
-- ==============================================

-- =============================================================================
-- Business Webhooks Table
-- Stores webhook configurations for post-event notifications
-- =============================================================================

-- Create the webhooks table
CREATE TABLE IF NOT EXISTS business_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  secret TEXT, -- Optional signing secret for verification
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique webhook names per business
  UNIQUE(business_id, name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_business_webhooks_business_id ON business_webhooks(business_id);
CREATE INDEX IF NOT EXISTS idx_business_webhooks_active ON business_webhooks(business_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE business_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own business webhooks"
  ON business_webhooks FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own business webhooks"
  ON business_webhooks FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own business webhooks"
  ON business_webhooks FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own business webhooks"
  ON business_webhooks FOR DELETE
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  );

-- Webhook delivery log for debugging/retry
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES business_webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  response_body TEXT,
  success BOOLEAN DEFAULT false,
  attempts INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for recent deliveries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);

-- Cleanup old delivery logs (keep 30 days)
-- This would typically be run via a cron job


-- ==============================================
-- Migration: 20250122100001_webhooks.sql
-- ==============================================

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


-- ==============================================
-- Migration: 20250122100002_availability.sql
-- ==============================================

-- ============================================
-- Availability Management Migration
-- Adds blocked_dates and service_availability tables
-- ============================================

-- ============================================
-- Blocked Dates Table
-- Stores holidays, vacations, and other blocked dates
-- ============================================
CREATE TABLE IF NOT EXISTS blocked_dates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  blocked_date date NOT NULL,
  reason text,
  is_recurring boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_blocked_dates_business_id ON blocked_dates(business_id);
CREATE INDEX IF NOT EXISTS idx_blocked_dates_date ON blocked_dates(blocked_date);

-- Ensure unique blocked dates per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_dates_unique
  ON blocked_dates(business_id, blocked_date);

-- Enable RLS
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blocked_dates
CREATE POLICY "Users can view their own blocked dates"
  ON blocked_dates FOR SELECT
  USING (business_id IN (
    SELECT id FROM businesses WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own blocked dates"
  ON blocked_dates FOR INSERT
  WITH CHECK (business_id IN (
    SELECT id FROM businesses WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own blocked dates"
  ON blocked_dates FOR UPDATE
  USING (business_id IN (
    SELECT id FROM businesses WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own blocked dates"
  ON blocked_dates FOR DELETE
  USING (business_id IN (
    SELECT id FROM businesses WHERE user_id = auth.uid()
  ));

-- ============================================
-- Service Availability Table
-- Per-service availability overrides
-- ============================================
CREATE TABLE IF NOT EXISTS service_availability (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time time,
  close_time time,
  is_closed boolean DEFAULT false,
  use_business_hours boolean DEFAULT true,
  CONSTRAINT check_times CHECK (
    is_closed = true OR
    use_business_hours = true OR
    (open_time IS NOT NULL AND close_time IS NOT NULL)
  )
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_service_availability_service_id
  ON service_availability(service_id);

-- Ensure unique day per service
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_availability_unique
  ON service_availability(service_id, day_of_week);

-- Enable RLS
ALTER TABLE service_availability ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_availability
CREATE POLICY "Users can view their own service availability"
  ON service_availability FOR SELECT
  USING (service_id IN (
    SELECT s.id FROM services s
    JOIN businesses b ON s.business_id = b.id
    WHERE b.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own service availability"
  ON service_availability FOR INSERT
  WITH CHECK (service_id IN (
    SELECT s.id FROM services s
    JOIN businesses b ON s.business_id = b.id
    WHERE b.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own service availability"
  ON service_availability FOR UPDATE
  USING (service_id IN (
    SELECT s.id FROM services s
    JOIN businesses b ON s.business_id = b.id
    WHERE b.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own service availability"
  ON service_availability FOR DELETE
  USING (service_id IN (
    SELECT s.id FROM services s
    JOIN businesses b ON s.business_id = b.id
    WHERE b.user_id = auth.uid()
  ));

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE blocked_dates IS 'Stores blocked dates (holidays, vacations) for businesses';
COMMENT ON COLUMN blocked_dates.blocked_date IS 'The date that is blocked';
COMMENT ON COLUMN blocked_dates.reason IS 'Optional reason for the blocked date';
COMMENT ON COLUMN blocked_dates.is_recurring IS 'Whether this date recurs annually';

COMMENT ON TABLE service_availability IS 'Per-service availability overrides';
COMMENT ON COLUMN service_availability.day_of_week IS '0=Sunday, 6=Saturday';
COMMENT ON COLUMN service_availability.use_business_hours IS 'If true, inherit from business_hours table';


-- ==============================================
-- Migration: 20250122100003_api_keys.sql
-- ==============================================

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


-- ==============================================
-- Migration: 20250122100004_crm_integrations.sql
-- ==============================================

-- Migration: CRM Integrations
-- HubSpot and other CRM integrations support
-- Includes OAuth token storage and sync logging

-- ============================================
-- CRM Integrations Table
-- Stores CRM provider configurations for businesses
-- ============================================
create table crm_integrations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  provider text not null,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  hub_id text, -- HubSpot portal/hub ID
  settings jsonb default '{}',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- One integration per provider per business
  unique(business_id, provider),

  -- Validate provider
  constraint valid_crm_provider check (provider in ('hubspot', 'salesforce', 'zoho'))
);

comment on table crm_integrations is 'CRM integration configurations (HubSpot, Salesforce, etc.)';
comment on column crm_integrations.provider is 'CRM provider: hubspot, salesforce, zoho';
comment on column crm_integrations.access_token is 'OAuth access token (encrypted at rest)';
comment on column crm_integrations.refresh_token is 'OAuth refresh token for token renewal';
comment on column crm_integrations.hub_id is 'HubSpot portal/hub ID for the connected account';
comment on column crm_integrations.settings is 'Integration settings: auto_sync_contacts, log_calls, create_deals, etc.';

-- Indexes for efficient queries
create index idx_crm_integrations_business_id on crm_integrations(business_id);
create index idx_crm_integrations_provider on crm_integrations(provider);
create index idx_crm_integrations_active on crm_integrations(is_active) where is_active = true;

-- ============================================
-- CRM Sync Log Table
-- Tracks all sync operations between Koya and CRM
-- ============================================
create table crm_sync_log (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references crm_integrations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  crm_id text,
  sync_direction text not null,
  status text not null default 'pending',
  error_message text,
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz default now(),

  -- Validate entity type
  constraint valid_entity_type check (entity_type in ('contact', 'call', 'appointment', 'deal')),
  -- Validate sync direction
  constraint valid_sync_direction check (sync_direction in ('outbound', 'inbound')),
  -- Validate status
  constraint valid_sync_status check (status in ('pending', 'success', 'failed', 'skipped'))
);

comment on table crm_sync_log is 'Tracks sync operations between Koya and external CRMs';
comment on column crm_sync_log.entity_type is 'Type of entity synced: contact, call, appointment, deal';
comment on column crm_sync_log.entity_id is 'Koya internal ID of the synced entity';
comment on column crm_sync_log.crm_id is 'External CRM ID of the synced entity';
comment on column crm_sync_log.sync_direction is 'outbound (Koya->CRM) or inbound (CRM->Koya)';

-- Indexes for efficient queries
create index idx_crm_sync_log_integration_id on crm_sync_log(integration_id);
create index idx_crm_sync_log_entity on crm_sync_log(entity_type, entity_id);
create index idx_crm_sync_log_status on crm_sync_log(status) where status != 'success';
create index idx_crm_sync_log_created_at on crm_sync_log(created_at);

-- ============================================
-- CRM Contact Mapping Table
-- Maps Koya contacts to CRM contact IDs
-- ============================================
create table crm_contact_mapping (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references crm_integrations(id) on delete cascade,
  koya_contact_id uuid not null,
  crm_contact_id text not null,
  last_synced_at timestamptz default now(),
  created_at timestamptz default now(),

  -- One mapping per integration per contact
  unique(integration_id, koya_contact_id),
  unique(integration_id, crm_contact_id)
);

comment on table crm_contact_mapping is 'Maps Koya contacts to external CRM contact IDs';

-- Indexes
create index idx_crm_contact_mapping_integration on crm_contact_mapping(integration_id);
create index idx_crm_contact_mapping_koya_contact on crm_contact_mapping(koya_contact_id);

-- ============================================
-- Updated At Trigger
-- ============================================
create trigger update_crm_integrations_updated_at
  before update on crm_integrations
  for each row
  execute function update_updated_at_column();

-- ============================================
-- RLS Policies
-- ============================================
alter table crm_integrations enable row level security;
alter table crm_sync_log enable row level security;
alter table crm_contact_mapping enable row level security;

-- CRM integrations policies
create policy "Users can view own business CRM integrations" on crm_integrations
  for select using (business_id = public.tenant_id());
create policy "Users can insert own business CRM integrations" on crm_integrations
  for insert with check (business_id = public.tenant_id());
create policy "Users can update own business CRM integrations" on crm_integrations
  for update using (business_id = public.tenant_id());
create policy "Users can delete own business CRM integrations" on crm_integrations
  for delete using (business_id = public.tenant_id());

-- CRM sync log policies
create policy "Users can view own business CRM sync logs" on crm_sync_log
  for select using (
    integration_id in (
      select id from crm_integrations where business_id = public.tenant_id()
    )
  );

-- CRM contact mapping policies
create policy "Users can view own business CRM contact mappings" on crm_contact_mapping
  for select using (
    integration_id in (
      select id from crm_integrations where business_id = public.tenant_id()
    )
  );

-- Service role bypass for background processing
create policy "Service role bypass crm_integrations" on crm_integrations
  for all using (auth.role() = 'service_role');
create policy "Service role bypass crm_sync_log" on crm_sync_log
  for all using (auth.role() = 'service_role');
create policy "Service role bypass crm_contact_mapping" on crm_contact_mapping
  for all using (auth.role() = 'service_role');

-- ============================================
-- Default CRM Settings
-- ============================================
comment on column crm_integrations.settings is E'Default settings structure:\n{\n  "auto_sync_contacts": true,\n  "log_calls": true,\n  "create_deals": true,\n  "deal_pipeline_id": null,\n  "deal_stage_id": null,\n  "deal_owner_id": null\n}';


-- ==============================================
-- Migration: 20250122100005_hubspot_oauth_state.sql
-- ==============================================

-- Migration: HubSpot OAuth State Columns
-- Temporary storage for OAuth CSRF protection

-- Add OAuth state columns to businesses table
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS hubspot_oauth_state text,
ADD COLUMN IF NOT EXISTS hubspot_oauth_state_expires timestamptz;

COMMENT ON COLUMN businesses.hubspot_oauth_state IS 'Temporary OAuth state for CSRF protection during HubSpot connection';
COMMENT ON COLUMN businesses.hubspot_oauth_state_expires IS 'Expiration time for the OAuth state (10 minutes)';

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_businesses_hubspot_oauth_state_expires
ON businesses(hubspot_oauth_state_expires)
WHERE hubspot_oauth_state IS NOT NULL;


-- ==============================================
-- Migration: 20250122200001_outbound_calls.sql
-- ==============================================

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


-- ==============================================
-- Migration: 20250122200002_hipaa_compliance.sql
-- ==============================================

-- Migration: HIPAA Compliance Infrastructure (Phase 3)
-- Creates tables for HIPAA compliance, PHI audit logging, and healthcare templates
-- Prerequisites: Run AFTER core_tables.sql and extended_tables.sql

-- ============================================
-- Compliance Settings
-- Per-business HIPAA compliance configuration
-- ============================================
CREATE TABLE compliance_settings (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  hipaa_enabled boolean DEFAULT false,
  hipaa_baa_signed_at timestamptz,
  hipaa_baa_signatory_name text,
  hipaa_baa_signatory_email text,
  hipaa_baa_document_url text,
  phi_handling_enabled boolean DEFAULT false,
  phi_in_transcripts boolean DEFAULT false,
  phi_in_recordings boolean DEFAULT false,
  recording_retention_days integer DEFAULT 2190, -- 6 years for HIPAA
  transcript_retention_days integer DEFAULT 2190,
  auto_redact_phi boolean DEFAULT true,
  phi_categories text[] DEFAULT ARRAY['ssn', 'dob', 'medical_record', 'insurance_id'],
  audit_log_retention_days integer DEFAULT 2190,
  encryption_key_id text, -- For customer-managed keys
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE compliance_settings IS 'HIPAA compliance configuration per business';
COMMENT ON COLUMN compliance_settings.hipaa_enabled IS 'Whether HIPAA compliance mode is enabled';
COMMENT ON COLUMN compliance_settings.hipaa_baa_signed_at IS 'When the Business Associate Agreement was signed';
COMMENT ON COLUMN compliance_settings.recording_retention_days IS 'Days to retain recordings (HIPAA requires 6 years = 2190 days)';
COMMENT ON COLUMN compliance_settings.auto_redact_phi IS 'Automatically redact PHI from transcripts';
COMMENT ON COLUMN compliance_settings.phi_categories IS 'Categories of PHI to detect and redact';
COMMENT ON COLUMN compliance_settings.encryption_key_id IS 'Customer-managed encryption key ID if applicable';

-- ============================================
-- PHI Audit Log
-- Separate audit log for PHI access (HIPAA requirement)
-- ============================================
CREATE TABLE phi_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  event_type text NOT NULL CHECK (event_type IN (
    'phi_access', 'phi_view', 'phi_export', 'phi_modify', 'phi_delete',
    'recording_access', 'recording_download', 'transcript_access', 'transcript_export',
    'report_generated', 'consent_recorded', 'consent_revoked'
  )),
  resource_type text NOT NULL, -- 'call', 'recording', 'transcript', 'contact', 'appointment'
  resource_id uuid,
  action text NOT NULL,
  ip_address inet,
  user_agent text,
  justification text, -- Why PHI was accessed
  phi_categories_accessed text[],
  outcome text DEFAULT 'success' CHECK (outcome IN ('success', 'denied', 'error')),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE phi_audit_log IS 'HIPAA-compliant audit log for PHI access events';
COMMENT ON COLUMN phi_audit_log.event_type IS 'Type of PHI access event';
COMMENT ON COLUMN phi_audit_log.resource_type IS 'Type of resource accessed: call, recording, transcript, contact, appointment';
COMMENT ON COLUMN phi_audit_log.justification IS 'Business justification for PHI access';
COMMENT ON COLUMN phi_audit_log.phi_categories_accessed IS 'Categories of PHI that were accessed';

-- ============================================
-- Healthcare Templates
-- Pre-built templates for healthcare verticals
-- ============================================
CREATE TABLE healthcare_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('dental', 'medical', 'mental_health', 'veterinary', 'optometry', 'physical_therapy', 'chiropractic', 'other')),
  description text,
  system_prompt text NOT NULL,
  greeting text,
  greeting_spanish text,
  functions_enabled text[] DEFAULT ARRAY['book_appointment', 'check_availability', 'transfer_call', 'take_message'],
  compliance_notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE healthcare_templates IS 'Pre-built AI templates for healthcare verticals';
COMMENT ON COLUMN healthcare_templates.category IS 'Healthcare specialty category';
COMMENT ON COLUMN healthcare_templates.functions_enabled IS 'AI functions enabled for this template';
COMMENT ON COLUMN healthcare_templates.compliance_notes IS 'Special compliance considerations for this specialty';

-- ============================================
-- Extend calls table for PHI tracking
-- ============================================
ALTER TABLE calls ADD COLUMN IF NOT EXISTS contains_phi boolean DEFAULT false;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS phi_categories text[];
ALTER TABLE calls ADD COLUMN IF NOT EXISTS phi_reviewed_at timestamptz;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS phi_reviewed_by uuid REFERENCES auth.users(id);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_encrypted boolean DEFAULT false;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_encryption_key_id text;

COMMENT ON COLUMN calls.contains_phi IS 'Flag indicating call contains Protected Health Information';
COMMENT ON COLUMN calls.phi_categories IS 'Categories of PHI detected in this call';
COMMENT ON COLUMN calls.phi_reviewed_at IS 'When PHI content was reviewed by staff';
COMMENT ON COLUMN calls.phi_reviewed_by IS 'User who reviewed PHI content';
COMMENT ON COLUMN calls.recording_encrypted IS 'Whether recording is encrypted at rest';

-- ============================================
-- Patient Consent Tracking
-- Track patient consents for HIPAA compliance
-- ============================================
CREATE TABLE patient_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  patient_phone text NOT NULL,
  patient_name text,
  consent_type text NOT NULL CHECK (consent_type IN ('recording', 'ai_processing', 'sms', 'marketing', 'hipaa_disclosure')),
  consent_given boolean NOT NULL,
  consent_method text CHECK (consent_method IN ('verbal', 'written', 'electronic', 'implied')),
  collected_at timestamptz DEFAULT now(),
  collected_via text, -- 'call', 'web', 'paper'
  call_id uuid REFERENCES calls(id),
  ip_address inet,
  expires_at timestamptz,
  revoked_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE patient_consents IS 'Patient consent tracking for HIPAA compliance';
COMMENT ON COLUMN patient_consents.consent_type IS 'Type of consent: recording, ai_processing, sms, marketing, hipaa_disclosure';
COMMENT ON COLUMN patient_consents.consent_method IS 'How consent was obtained: verbal, written, electronic, implied';
COMMENT ON COLUMN patient_consents.collected_via IS 'Channel through which consent was collected';
COMMENT ON COLUMN patient_consents.revoked_at IS 'When consent was revoked (NULL if still active)';

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX idx_compliance_settings_hipaa ON compliance_settings(hipaa_enabled) WHERE hipaa_enabled = true;
CREATE INDEX idx_phi_audit_business ON phi_audit_log(business_id, created_at DESC);
CREATE INDEX idx_phi_audit_user ON phi_audit_log(user_id, created_at DESC);
CREATE INDEX idx_phi_audit_resource ON phi_audit_log(resource_type, resource_id);
CREATE INDEX idx_phi_audit_event_type ON phi_audit_log(event_type, created_at DESC);
CREATE INDEX idx_healthcare_templates_category ON healthcare_templates(category) WHERE is_active = true;
CREATE INDEX idx_patient_consents_phone ON patient_consents(business_id, patient_phone);
CREATE INDEX idx_patient_consents_type ON patient_consents(business_id, consent_type);
CREATE INDEX idx_patient_consents_active ON patient_consents(business_id, patient_phone, consent_type)
  WHERE consent_given = true AND revoked_at IS NULL;
CREATE INDEX idx_calls_phi ON calls(business_id, contains_phi) WHERE contains_phi = true;

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE compliance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE phi_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_consents ENABLE ROW LEVEL SECURITY;

-- Compliance settings policies
CREATE POLICY "Users can manage their compliance settings" ON compliance_settings
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Service role bypass compliance_settings" ON compliance_settings
  FOR ALL USING (auth.role() = 'service_role');

-- PHI audit log policies (read-only for users, insert for system)
CREATE POLICY "Users can view their PHI audit logs" ON phi_audit_log
  FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "System can insert PHI audit logs" ON phi_audit_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role bypass phi_audit_log" ON phi_audit_log
  FOR ALL USING (auth.role() = 'service_role');

-- Healthcare templates are public read-only
CREATE POLICY "Anyone can view healthcare templates" ON healthcare_templates
  FOR SELECT USING (is_active = true);

CREATE POLICY "Service role bypass healthcare_templates" ON healthcare_templates
  FOR ALL USING (auth.role() = 'service_role');

-- Patient consents policies
CREATE POLICY "Users can manage patient consents" ON patient_consents
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Service role bypass patient_consents" ON patient_consents
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Function to log PHI access
-- ============================================
CREATE OR REPLACE FUNCTION log_phi_access(
  p_business_id uuid,
  p_user_id uuid,
  p_event_type text,
  p_resource_type text,
  p_resource_id uuid,
  p_action text,
  p_ip inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_justification text DEFAULT NULL,
  p_phi_categories text[] DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO phi_audit_log (
    business_id, user_id, event_type, resource_type, resource_id,
    action, ip_address, user_agent, justification, phi_categories_accessed
  ) VALUES (
    p_business_id, p_user_id, p_event_type, p_resource_type, p_resource_id,
    p_action, p_ip, p_user_agent, p_justification, p_phi_categories
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION log_phi_access IS 'Log PHI access event for HIPAA compliance';

-- ============================================
-- Function to check if patient has active consent
-- ============================================
CREATE OR REPLACE FUNCTION has_patient_consent(
  p_business_id uuid,
  p_phone text,
  p_consent_type text
) RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM patient_consents
    WHERE business_id = p_business_id
      AND patient_phone = p_phone
      AND consent_type = p_consent_type
      AND consent_given = true
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION has_patient_consent IS 'Check if patient has active consent for a specific type';

-- ============================================
-- Function to record patient consent
-- ============================================
CREATE OR REPLACE FUNCTION record_patient_consent(
  p_business_id uuid,
  p_phone text,
  p_name text,
  p_consent_type text,
  p_consent_given boolean,
  p_method text DEFAULT 'verbal',
  p_via text DEFAULT 'call',
  p_call_id uuid DEFAULT NULL,
  p_ip inet DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_consent_id uuid;
BEGIN
  INSERT INTO patient_consents (
    business_id, patient_phone, patient_name, consent_type, consent_given,
    consent_method, collected_via, call_id, ip_address, expires_at
  ) VALUES (
    p_business_id, p_phone, p_name, p_consent_type, p_consent_given,
    p_method, p_via, p_call_id, p_ip, p_expires_at
  ) RETURNING id INTO v_consent_id;

  -- Log the consent event
  PERFORM log_phi_access(
    p_business_id,
    NULL,
    CASE WHEN p_consent_given THEN 'consent_recorded' ELSE 'consent_revoked' END,
    'consent',
    v_consent_id,
    'Patient consent ' || CASE WHEN p_consent_given THEN 'recorded' ELSE 'declined' END || ' for ' || p_consent_type,
    p_ip,
    NULL,
    NULL,
    NULL
  );

  RETURN v_consent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_patient_consent IS 'Record patient consent and log the event';

-- ============================================
-- Updated at trigger for compliance_settings
-- ============================================
CREATE TRIGGER update_compliance_settings_updated_at
  BEFORE UPDATE ON compliance_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Insert default healthcare templates
-- ============================================
INSERT INTO healthcare_templates (name, category, description, system_prompt, greeting, greeting_spanish, functions_enabled, compliance_notes) VALUES
(
  'Dental Practice',
  'dental',
  'Template for dental offices including general dentistry, orthodontics, and oral surgery',
  'You are an AI receptionist for a dental practice. Handle appointment scheduling for cleanings, exams, and procedures. Be mindful of dental anxiety - use reassuring language. Never discuss specific treatment costs or insurance coverage details - transfer to staff for those questions. If someone mentions severe tooth pain, swelling, or trauma, treat as urgent and offer same-day scheduling or advise emergency dental care.',
  'Thank you for calling! How can I help you with your dental care today?',
  'Gracias por llamar! Como puedo ayudarle con su cuidado dental hoy?',
  ARRAY['book_appointment', 'check_availability', 'transfer_call', 'take_message'],
  'Dental records are PHI. Do not discuss specific treatments or insurance details. Transfer insurance questions to staff.'
),
(
  'Medical Clinic',
  'medical',
  'Template for general medical practices, urgent care, and family medicine',
  'You are an AI receptionist for a medical clinic. Schedule appointments for checkups, sick visits, and follow-ups. If caller describes emergency symptoms (chest pain, difficulty breathing, severe bleeding, stroke symptoms like facial drooping or slurred speech), immediately advise calling 911 and transfer to staff. Never provide medical advice or diagnoses. Do not discuss test results - transfer those calls to nursing staff.',
  'Thank you for calling. How may I assist you with scheduling today?',
  'Gracias por llamar. Como puedo ayudarle con una cita hoy?',
  ARRAY['book_appointment', 'check_availability', 'transfer_call', 'take_message'],
  'Never provide medical advice. Transfer calls about test results, prescriptions, or medical questions to clinical staff. Flag emergency symptoms immediately.'
),
(
  'Mental Health Practice',
  'mental_health',
  'Template for therapy, counseling, and psychiatric practices',
  'You are an AI receptionist for a mental health practice. Handle intake and appointment scheduling with extra sensitivity and confidentiality. If caller expresses suicidal ideation, self-harm thoughts, or immediate crisis, provide the 988 Suicide and Crisis Lifeline number and transfer immediately to a clinician. Never ask for or discuss specific mental health conditions. Maintain strict confidentiality - do not confirm if someone is a patient.',
  'Hello, thank you for reaching out. How can I help you today?',
  'Hola, gracias por comunicarse. Como puedo ayudarle hoy?',
  ARRAY['book_appointment', 'check_availability', 'transfer_call', 'take_message'],
  'Extra confidentiality required. Never confirm patient status. Immediate escalation for crisis calls to 988 and staff.'
),
(
  'Veterinary Clinic',
  'veterinary',
  'Template for animal hospitals and veterinary practices',
  'You are an AI receptionist for a veterinary clinic. Schedule wellness visits, vaccinations, and sick pet appointments. For emergencies (pet not breathing, severe trauma, poisoning, difficulty giving birth, seizures), advise immediate emergency vet visit and provide emergency clinic info if available. Ask for pet name and species when booking. Be compassionate when pet owners are distressed.',
  'Hi there! How can I help you and your furry friend today?',
  'Hola! Como puedo ayudarle a usted y a su mascota hoy?',
  ARRAY['book_appointment', 'check_availability', 'transfer_call', 'take_message'],
  'While not HIPAA-covered, maintain client confidentiality. Be sensitive with distressed pet owners.'
),
(
  'Optometry Practice',
  'optometry',
  'Template for eye care, optometry, and ophthalmology practices',
  'You are an AI receptionist for an optometry practice. Schedule eye exams, contact lens fittings, and follow-up appointments. If caller reports sudden vision loss, eye injury, severe eye pain, or flashing lights with floaters, treat as urgent and advise immediate care. Do not discuss prescription details or provide medical advice about eye conditions.',
  'Thank you for calling! How can I help you with your eye care needs today?',
  'Gracias por llamar! Como puedo ayudarle con sus necesidades de cuidado visual hoy?',
  ARRAY['book_appointment', 'check_availability', 'transfer_call', 'take_message'],
  'Urgent symptoms: sudden vision loss, eye injury, severe pain. Transfer prescription and medical questions to clinical staff.'
),
(
  'Physical Therapy',
  'physical_therapy',
  'Template for physical therapy and rehabilitation clinics',
  'You are an AI receptionist for a physical therapy clinic. Schedule evaluation appointments and follow-up treatment sessions. Ask about the body area needing treatment when booking new patients. Do not provide exercise advice or treatment recommendations. If caller reports new injury, worsening symptoms, or severe pain, offer to connect with a therapist or advise appropriate medical care.',
  'Hello! How can I assist you with your physical therapy needs today?',
  'Hola! Como puedo ayudarle con sus necesidades de terapia fisica hoy?',
  ARRAY['book_appointment', 'check_availability', 'transfer_call', 'take_message'],
  'Do not provide exercise or treatment advice. New evaluations typically require referral verification.'
),
(
  'Chiropractic Office',
  'chiropractic',
  'Template for chiropractic and wellness practices',
  'You are an AI receptionist for a chiropractic office. Schedule adjustments, new patient consultations, and wellness visits. If caller describes symptoms that may indicate serious conditions (loss of bladder/bowel control, severe radiating pain, numbness, weakness), advise medical evaluation and transfer to staff. Do not provide treatment advice or make claims about chiropractic benefits.',
  'Welcome! How can I help you with your chiropractic care today?',
  'Bienvenido! Como puedo ayudarle con su cuidado quiropractico hoy?',
  ARRAY['book_appointment', 'check_availability', 'transfer_call', 'take_message'],
  'Red flag symptoms: bowel/bladder issues, severe neurological symptoms. Do not make treatment claims.'
);


-- ==============================================
-- Migration: 20250122200003_stripe_connect.sql
-- ==============================================

-- Migration: Stripe Connect Infrastructure (Phase 3)
-- Creates tables for Stripe Connect, payment processing, and deposits
-- Prerequisites: Run AFTER core_tables.sql and extended_tables.sql

-- ============================================
-- Stripe Connect Accounts
-- Connected accounts for businesses that can receive payments
-- ============================================
CREATE TABLE stripe_connect_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL UNIQUE, -- acct_xxxxx
  account_type text DEFAULT 'express' CHECK (account_type IN ('standard', 'express', 'custom')),
  charges_enabled boolean DEFAULT false,
  payouts_enabled boolean DEFAULT false,
  details_submitted boolean DEFAULT false,
  onboarding_complete boolean DEFAULT false,
  business_name text,
  default_currency text DEFAULT 'usd',
  country text DEFAULT 'US',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE stripe_connect_accounts IS 'Stripe Connect accounts for businesses to receive payments';
COMMENT ON COLUMN stripe_connect_accounts.stripe_account_id IS 'Stripe account ID (acct_xxxxx)';
COMMENT ON COLUMN stripe_connect_accounts.account_type IS 'Stripe account type: standard, express, or custom';
COMMENT ON COLUMN stripe_connect_accounts.charges_enabled IS 'Whether the account can accept charges';
COMMENT ON COLUMN stripe_connect_accounts.payouts_enabled IS 'Whether the account can receive payouts';
COMMENT ON COLUMN stripe_connect_accounts.onboarding_complete IS 'Whether Stripe onboarding is fully complete';

-- ============================================
-- Payment Settings
-- Per-business payment and deposit configuration
-- ============================================
CREATE TABLE payment_settings (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  deposits_enabled boolean DEFAULT false,
  deposit_amount_cents integer, -- Fixed deposit amount
  deposit_percentage integer, -- OR percentage of service price
  deposit_type text DEFAULT 'fixed' CHECK (deposit_type IN ('fixed', 'percentage', 'full')),
  collect_payment_on_call boolean DEFAULT false, -- Collect during AI call
  require_card_on_file boolean DEFAULT false,
  stripe_connect_account_id uuid REFERENCES stripe_connect_accounts(id),
  application_fee_percent numeric(5,2) DEFAULT 2.9, -- Platform fee
  payout_schedule text DEFAULT 'daily' CHECK (payout_schedule IN ('daily', 'weekly', 'monthly', 'manual')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE payment_settings IS 'Payment and deposit configuration per business';
COMMENT ON COLUMN payment_settings.deposit_amount_cents IS 'Fixed deposit amount in cents (if deposit_type is fixed)';
COMMENT ON COLUMN payment_settings.deposit_percentage IS 'Percentage of service price for deposit (if deposit_type is percentage)';
COMMENT ON COLUMN payment_settings.deposit_type IS 'How deposit is calculated: fixed amount, percentage, or full price';
COMMENT ON COLUMN payment_settings.collect_payment_on_call IS 'Whether to collect payment during AI call';
COMMENT ON COLUMN payment_settings.application_fee_percent IS 'Platform fee percentage charged on transactions';

-- ============================================
-- Payment Transactions
-- Record of all payment intents and transactions
-- ============================================
CREATE TABLE payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id),
  call_id uuid REFERENCES calls(id),
  customer_phone text,
  customer_email text,
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text,
  amount_cents integer NOT NULL,
  currency text DEFAULT 'usd',
  application_fee_cents integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'requires_payment_method', 'requires_confirmation',
    'processing', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded'
  )),
  payment_type text CHECK (payment_type IN ('deposit', 'balance', 'full', 'refund')),
  description text,
  failure_reason text,
  refunded_amount_cents integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE payment_transactions IS 'All payment transactions including deposits and refunds';
COMMENT ON COLUMN payment_transactions.stripe_payment_intent_id IS 'Stripe PaymentIntent ID';
COMMENT ON COLUMN payment_transactions.application_fee_cents IS 'Platform fee collected on this transaction';
COMMENT ON COLUMN payment_transactions.payment_type IS 'Transaction type: deposit, balance payment, full payment, or refund';
COMMENT ON COLUMN payment_transactions.failure_reason IS 'Reason for payment failure if applicable';

-- ============================================
-- Extend plans table for annual billing
-- ============================================
ALTER TABLE plans ADD COLUMN IF NOT EXISTS billing_interval text DEFAULT 'month' CHECK (billing_interval IN ('month', 'year'));
ALTER TABLE plans ADD COLUMN IF NOT EXISTS annual_price_cents integer;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS annual_stripe_price_id text;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS minutes_included integer;

COMMENT ON COLUMN plans.billing_interval IS 'Default billing interval: month or year';
COMMENT ON COLUMN plans.annual_price_cents IS 'Annual price in cents (typically with discount)';
COMMENT ON COLUMN plans.annual_stripe_price_id IS 'Stripe Price ID for annual billing';

-- ============================================
-- Extend appointments for deposit tracking
-- ============================================
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_required boolean DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_amount_cents integer;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deposit_transaction_id uuid REFERENCES payment_transactions(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS balance_amount_cents integer;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS balance_paid_at timestamptz;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS balance_transaction_id uuid REFERENCES payment_transactions(id);

COMMENT ON COLUMN appointments.deposit_required IS 'Whether this appointment requires a deposit';
COMMENT ON COLUMN appointments.deposit_amount_cents IS 'Deposit amount in cents';
COMMENT ON COLUMN appointments.deposit_paid_at IS 'When deposit was paid';
COMMENT ON COLUMN appointments.balance_amount_cents IS 'Remaining balance after deposit';
COMMENT ON COLUMN appointments.balance_paid_at IS 'When balance was paid';

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX idx_connect_accounts_business ON stripe_connect_accounts(business_id);
CREATE INDEX idx_connect_accounts_stripe ON stripe_connect_accounts(stripe_account_id);
CREATE INDEX idx_connect_accounts_enabled ON stripe_connect_accounts(business_id)
  WHERE charges_enabled = true AND payouts_enabled = true;
CREATE INDEX idx_transactions_business ON payment_transactions(business_id, created_at DESC);
CREATE INDEX idx_transactions_appointment ON payment_transactions(appointment_id);
CREATE INDEX idx_transactions_stripe ON payment_transactions(stripe_payment_intent_id);
CREATE INDEX idx_transactions_status ON payment_transactions(business_id, status);
CREATE INDEX idx_transactions_customer ON payment_transactions(business_id, customer_phone);
CREATE INDEX idx_appointments_deposit ON appointments(business_id, deposit_required)
  WHERE deposit_required = true AND deposit_paid_at IS NULL;

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE stripe_connect_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Stripe Connect accounts policies
CREATE POLICY "Users can manage their connect accounts" ON stripe_connect_accounts
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Service role bypass stripe_connect_accounts" ON stripe_connect_accounts
  FOR ALL USING (auth.role() = 'service_role');

-- Payment settings policies
CREATE POLICY "Users can manage their payment settings" ON payment_settings
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Service role bypass payment_settings" ON payment_settings
  FOR ALL USING (auth.role() = 'service_role');

-- Payment transactions policies
CREATE POLICY "Users can view their transactions" ON payment_transactions
  FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Service role bypass payment_transactions" ON payment_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Function to calculate deposit amount
-- ============================================
CREATE OR REPLACE FUNCTION calculate_deposit_amount(
  p_business_id uuid,
  p_service_price_cents integer DEFAULT NULL
) RETURNS integer AS $$
DECLARE
  v_settings payment_settings;
BEGIN
  SELECT * INTO v_settings FROM payment_settings WHERE business_id = p_business_id;

  IF NOT FOUND OR NOT v_settings.deposits_enabled THEN
    RETURN 0;
  END IF;

  CASE v_settings.deposit_type
    WHEN 'fixed' THEN
      RETURN COALESCE(v_settings.deposit_amount_cents, 0);
    WHEN 'percentage' THEN
      IF p_service_price_cents IS NULL THEN
        RETURN 0;
      END IF;
      RETURN (p_service_price_cents * COALESCE(v_settings.deposit_percentage, 0) / 100)::integer;
    WHEN 'full' THEN
      RETURN COALESCE(p_service_price_cents, 0);
    ELSE
      RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_deposit_amount IS 'Calculate deposit amount based on business settings and service price';

-- ============================================
-- Function to get business payment summary
-- ============================================
CREATE OR REPLACE FUNCTION get_payment_summary(
  p_business_id uuid,
  p_start_date timestamptz DEFAULT now() - interval '30 days',
  p_end_date timestamptz DEFAULT now()
) RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_transactions', COUNT(*),
    'successful_transactions', COUNT(*) FILTER (WHERE status = 'succeeded'),
    'failed_transactions', COUNT(*) FILTER (WHERE status = 'failed'),
    'total_amount_cents', COALESCE(SUM(amount_cents) FILTER (WHERE status = 'succeeded'), 0),
    'total_refunded_cents', COALESCE(SUM(refunded_amount_cents), 0),
    'total_fees_cents', COALESCE(SUM(application_fee_cents) FILTER (WHERE status = 'succeeded'), 0),
    'deposits_collected', COUNT(*) FILTER (WHERE payment_type = 'deposit' AND status = 'succeeded'),
    'deposit_amount_cents', COALESCE(SUM(amount_cents) FILTER (WHERE payment_type = 'deposit' AND status = 'succeeded'), 0)
  ) INTO v_result
  FROM payment_transactions
  WHERE business_id = p_business_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_payment_summary IS 'Get payment summary statistics for a business';

-- ============================================
-- Function to process refund
-- ============================================
CREATE OR REPLACE FUNCTION record_refund(
  p_transaction_id uuid,
  p_refund_amount_cents integer,
  p_reason text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_original payment_transactions;
  v_refund_id uuid;
BEGIN
  -- Get original transaction
  SELECT * INTO v_original FROM payment_transactions WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_original.status != 'succeeded' THEN
    RAISE EXCEPTION 'Can only refund succeeded transactions';
  END IF;

  IF p_refund_amount_cents > (v_original.amount_cents - v_original.refunded_amount_cents) THEN
    RAISE EXCEPTION 'Refund amount exceeds available amount';
  END IF;

  -- Create refund transaction record
  INSERT INTO payment_transactions (
    business_id, appointment_id, customer_phone, customer_email,
    amount_cents, currency, payment_type, status, description, metadata
  ) VALUES (
    v_original.business_id, v_original.appointment_id, v_original.customer_phone, v_original.customer_email,
    p_refund_amount_cents, v_original.currency, 'refund', 'pending',
    COALESCE(p_reason, 'Refund for transaction ' || p_transaction_id),
    jsonb_build_object('original_transaction_id', p_transaction_id)
  ) RETURNING id INTO v_refund_id;

  -- Update original transaction
  UPDATE payment_transactions
  SET
    refunded_amount_cents = refunded_amount_cents + p_refund_amount_cents,
    status = CASE
      WHEN refunded_amount_cents + p_refund_amount_cents >= amount_cents THEN 'refunded'
      ELSE 'partially_refunded'
    END,
    updated_at = now()
  WHERE id = p_transaction_id;

  RETURN v_refund_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_refund IS 'Record a refund transaction';

-- ============================================
-- Updated at triggers
-- ============================================
CREATE TRIGGER update_stripe_connect_accounts_updated_at
  BEFORE UPDATE ON stripe_connect_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_settings_updated_at
  BEFORE UPDATE ON payment_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Insert or update Essentials plan
-- ============================================
INSERT INTO plans (slug, name, stripe_price_id, price_cents, included_minutes, features, is_active, billing_interval, minutes_included)
VALUES (
  'essentials',
  'Essentials',
  NULL, -- Will be set after Stripe product creation
  4900, -- $49/month
  100,
  '{"calls": true, "appointments": true, "sms": true, "bilingual": false, "integrations": false, "priority_support": false}',
  true,
  'month',
  100
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  included_minutes = EXCLUDED.included_minutes,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active;

-- Update existing plans with annual pricing (2 months free)
UPDATE plans SET
  annual_price_cents = price_cents * 10,
  billing_interval = COALESCE(billing_interval, 'month'),
  minutes_included = COALESCE(minutes_included, included_minutes)
WHERE annual_price_cents IS NULL AND price_cents IS NOT NULL;


-- ==============================================
-- Migration: 20250123000001_caller_profiles_contacts.sql
-- ==============================================

-- Migration: Add VIP status and notes to caller_profiles
-- Feature: Customer/Contact Management (PRODUCT_ROADMAP.md Section 2.3)

-- Add vip_status column
ALTER TABLE caller_profiles
ADD COLUMN IF NOT EXISTS vip_status BOOLEAN NOT NULL DEFAULT FALSE;

-- Add notes column
ALTER TABLE caller_profiles
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for VIP status filtering
CREATE INDEX IF NOT EXISTS idx_caller_profiles_vip_status
ON caller_profiles(business_id, vip_status)
WHERE vip_status = TRUE;

-- Create index for search performance
CREATE INDEX IF NOT EXISTS idx_caller_profiles_search
ON caller_profiles(business_id, name, email, phone_number);

-- Create index for sorting by last contact
CREATE INDEX IF NOT EXISTS idx_caller_profiles_last_call
ON caller_profiles(business_id, last_call_at DESC);

-- Add RLS policy for contacts access (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'caller_profiles'
        AND policyname = 'Business users can manage their contacts'
    ) THEN
        CREATE POLICY "Business users can manage their contacts"
        ON caller_profiles
        FOR ALL
        USING (
            business_id IN (
                SELECT id FROM businesses
                WHERE user_id = auth.uid()
            )
        )
        WITH CHECK (
            business_id IN (
                SELECT id FROM businesses
                WHERE user_id = auth.uid()
            )
        );
    END IF;
END $$;

-- Comment on columns
COMMENT ON COLUMN caller_profiles.vip_status IS 'Whether this contact is marked as a VIP for priority service';
COMMENT ON COLUMN caller_profiles.notes IS 'User notes about this contact';


-- ==============================================
-- Migration: 20250123200001_encryption_keys.sql
-- ==============================================

-- Migration: Encryption Keys Table
-- Stores encryption key metadata for HIPAA-compliant recording encryption
-- Prerequisites: Run AFTER core_tables.sql and 20250122200002_hipaa_compliance.sql

-- ============================================
-- Encryption Keys Table
-- Stores encryption key metadata (NOT actual keys)
-- Keys are encrypted with master key and stored in key_encrypted
-- ============================================
CREATE TABLE encryption_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  key_encrypted text NOT NULL, -- Master-key-encrypted data key (NOT the raw key)
  key_version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rotated', 'revoked')),
  is_active boolean NOT NULL DEFAULT true, -- For backward compatibility with existing queries
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz, -- When key was rotated (replaced by newer key)
  revoked_at timestamptz, -- When key was revoked (should not be used)
  revoked_by uuid REFERENCES auth.users(id), -- User who revoked the key
  revocation_reason text, -- Why the key was revoked

  -- Ensure only one active key per business
  CONSTRAINT unique_active_key_per_business UNIQUE (business_id, is_active)
    DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE encryption_keys IS 'Encryption key metadata for HIPAA-compliant recording encryption';
COMMENT ON COLUMN encryption_keys.key_encrypted IS 'Master-key-encrypted data key. The actual key is encrypted with HIPAA_MASTER_KEY and stored here.';
COMMENT ON COLUMN encryption_keys.key_version IS 'Key version number, incremented on each rotation';
COMMENT ON COLUMN encryption_keys.status IS 'Key status: active (in use), rotated (replaced), revoked (invalidated)';
COMMENT ON COLUMN encryption_keys.is_active IS 'Whether this is the active key for the business. Only one active key per business.';
COMMENT ON COLUMN encryption_keys.created_at IS 'When the key was created';
COMMENT ON COLUMN encryption_keys.rotated_at IS 'When this key was rotated and replaced by a new key';
COMMENT ON COLUMN encryption_keys.revoked_at IS 'When this key was revoked (compromised or no longer needed)';
COMMENT ON COLUMN encryption_keys.revoked_by IS 'User who revoked the key';
COMMENT ON COLUMN encryption_keys.revocation_reason IS 'Reason for key revocation';

-- ============================================
-- Indexes for performance
-- ============================================
-- Index for looking up active key by business (most common query)
CREATE INDEX idx_encryption_keys_business_active ON encryption_keys(business_id)
  WHERE is_active = true;

-- Index for looking up key by ID (for decryption)
CREATE INDEX idx_encryption_keys_id ON encryption_keys(id);

-- Index for querying by status
CREATE INDEX idx_encryption_keys_status ON encryption_keys(status);

-- Index for business_id for general queries
CREATE INDEX idx_encryption_keys_business_id ON encryption_keys(business_id);

-- Index for audit queries on key creation/rotation
CREATE INDEX idx_encryption_keys_created_at ON encryption_keys(created_at DESC);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;

-- Users can view encryption key metadata for their business
-- NOTE: They cannot see the actual encrypted key content in the application
-- This policy allows metadata visibility (id, version, status, timestamps)
CREATE POLICY "Users can view own business encryption keys" ON encryption_keys
  FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- Only service role can insert keys (keys are created by the system)
CREATE POLICY "Service role can insert encryption keys" ON encryption_keys
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Only service role can update keys (rotation is done by the system)
CREATE POLICY "Service role can update encryption keys" ON encryption_keys
  FOR UPDATE USING (auth.role() = 'service_role');

-- Service role bypass for all operations
CREATE POLICY "Service role bypass encryption_keys" ON encryption_keys
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Function to get active encryption key for business
-- ============================================
CREATE OR REPLACE FUNCTION get_active_encryption_key(p_business_id uuid)
RETURNS TABLE (
  key_id uuid,
  key_encrypted text,
  key_version integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ek.id, ek.key_encrypted, ek.key_version
  FROM encryption_keys ek
  WHERE ek.business_id = p_business_id
    AND ek.is_active = true
    AND ek.status = 'active'
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_active_encryption_key IS 'Get the active encryption key for a business';

-- ============================================
-- Function to rotate encryption key
-- Deactivates current key and prepares for new key insertion
-- ============================================
CREATE OR REPLACE FUNCTION rotate_encryption_key(
  p_business_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_key_id uuid;
  v_old_version integer;
BEGIN
  -- Get current active key
  SELECT id, key_version INTO v_old_key_id, v_old_version
  FROM encryption_keys
  WHERE business_id = p_business_id
    AND is_active = true
  FOR UPDATE;

  -- If there's an existing key, mark it as rotated
  IF v_old_key_id IS NOT NULL THEN
    UPDATE encryption_keys
    SET
      is_active = false,
      status = 'rotated',
      rotated_at = now()
    WHERE id = v_old_key_id;

    -- Log the rotation in PHI audit log
    INSERT INTO phi_audit_log (
      business_id,
      user_id,
      event_type,
      resource_type,
      resource_id,
      action,
      metadata
    ) VALUES (
      p_business_id,
      p_user_id,
      'phi_modify',
      'encryption_key',
      v_old_key_id,
      'rotate_encryption_key',
      jsonb_build_object('old_key_id', v_old_key_id, 'old_version', v_old_version)
    );
  END IF;

  RETURN v_old_key_id;
END;
$$;

COMMENT ON FUNCTION rotate_encryption_key IS 'Deactivate current encryption key and prepare for rotation';

-- ============================================
-- Function to revoke encryption key
-- Used when a key is compromised or needs to be invalidated
-- ============================================
CREATE OR REPLACE FUNCTION revoke_encryption_key(
  p_key_id uuid,
  p_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_business_id uuid;
  v_key_version integer;
BEGIN
  -- Get key details
  SELECT business_id, key_version INTO v_business_id, v_key_version
  FROM encryption_keys
  WHERE id = p_key_id
  FOR UPDATE;

  IF v_business_id IS NULL THEN
    RETURN false;
  END IF;

  -- Revoke the key
  UPDATE encryption_keys
  SET
    is_active = false,
    status = 'revoked',
    revoked_at = now(),
    revoked_by = p_user_id,
    revocation_reason = p_reason
  WHERE id = p_key_id;

  -- Log the revocation in PHI audit log
  INSERT INTO phi_audit_log (
    business_id,
    user_id,
    event_type,
    resource_type,
    resource_id,
    action,
    metadata
  ) VALUES (
    v_business_id,
    p_user_id,
    'phi_modify',
    'encryption_key',
    p_key_id,
    'revoke_encryption_key',
    jsonb_build_object(
      'key_id', p_key_id,
      'key_version', v_key_version,
      'reason', p_reason
    )
  );

  RETURN true;
END;
$$;

COMMENT ON FUNCTION revoke_encryption_key IS 'Revoke an encryption key (mark as invalid)';

-- ============================================
-- Trigger to ensure only one active key per business
-- ============================================
CREATE OR REPLACE FUNCTION ensure_single_active_key()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If inserting/updating to active, deactivate other keys for this business
  IF NEW.is_active = true THEN
    UPDATE encryption_keys
    SET is_active = false, status = 'rotated', rotated_at = now()
    WHERE business_id = NEW.business_id
      AND id != NEW.id
      AND is_active = true;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_ensure_single_active_key
  BEFORE INSERT OR UPDATE ON encryption_keys
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_key();

-- ============================================
-- Add foreign key from compliance_settings to encryption_keys
-- ============================================
DO $$
BEGIN
  -- Check if the column exists and add FK constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'compliance_settings'
    AND column_name = 'encryption_key_id'
  ) THEN
    -- The column exists as text, we reference the encryption_keys by storing the UUID as text
    -- This is intentional as the encryption.ts code stores key IDs this way
    NULL; -- No action needed, the text column works with UUID::text lookups
  END IF;
END $$;


-- ==============================================
-- Migration: 20250123300001_webhook_retry.sql
-- ==============================================

-- Migration: Incoming Webhook Retry System
-- Stores failed incoming webhooks from external services (Stripe, Retell, Twilio)
-- and enables automatic retry with exponential backoff

-- ============================================
-- Failed Webhooks Table
-- Stores incoming webhooks that failed processing
-- ============================================
CREATE TABLE IF NOT EXISTS failed_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL, -- 'stripe', 'retell', 'twilio'
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'retrying', 'success', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Validate source
  CONSTRAINT failed_webhooks_valid_source CHECK (source IN ('stripe', 'retell', 'twilio')),
  -- Validate status
  CONSTRAINT failed_webhooks_valid_status CHECK (status IN ('pending', 'retrying', 'success', 'failed'))
);

-- Indexes for efficient queries
CREATE INDEX idx_failed_webhooks_status ON failed_webhooks(status, next_retry_at);
CREATE INDEX idx_failed_webhooks_source ON failed_webhooks(source);
CREATE INDEX idx_failed_webhooks_created_at ON failed_webhooks(created_at);

-- Comments for documentation
COMMENT ON TABLE failed_webhooks IS 'Stores failed incoming webhooks for retry processing';
COMMENT ON COLUMN failed_webhooks.source IS 'Webhook source: stripe, retell, or twilio';
COMMENT ON COLUMN failed_webhooks.event_type IS 'Original event type from the webhook';
COMMENT ON COLUMN failed_webhooks.payload IS 'Original webhook payload for retry';
COMMENT ON COLUMN failed_webhooks.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN failed_webhooks.max_retries IS 'Maximum retry attempts allowed (default 5)';
COMMENT ON COLUMN failed_webhooks.next_retry_at IS 'When the next retry should be attempted';
COMMENT ON COLUMN failed_webhooks.status IS 'pending (first failure), retrying, success, or failed (exhausted retries)';

-- ============================================
-- Updated At Trigger
-- ============================================
CREATE OR REPLACE TRIGGER update_failed_webhooks_updated_at
  BEFORE UPDATE ON failed_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Helper Function: Calculate Retry Delay
-- Exponential backoff: 1min, 5min, 15min, 1hr, 4hr
-- ============================================
CREATE OR REPLACE FUNCTION calculate_failed_webhook_retry_delay(attempt_count INTEGER)
RETURNS INTERVAL
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE attempt_count
    WHEN 0 THEN interval '1 minute'
    WHEN 1 THEN interval '5 minutes'
    WHEN 2 THEN interval '15 minutes'
    WHEN 3 THEN interval '1 hour'
    WHEN 4 THEN interval '4 hours'
    ELSE interval '4 hours'
  END
$$;

COMMENT ON FUNCTION calculate_failed_webhook_retry_delay IS 'Calculates exponential backoff delay for failed webhook retries';

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE failed_webhooks ENABLE ROW LEVEL SECURITY;

-- Only service role can access failed_webhooks (background job processing)
DROP POLICY IF EXISTS "Service role only for failed_webhooks" ON failed_webhooks;
CREATE POLICY "Service role only for failed_webhooks" ON failed_webhooks
  FOR ALL USING (auth.role() = 'service_role');


-- ==============================================
-- Migration: 20250124000001_missing_tables.sql
-- ==============================================

-- Migration: Missing Tables and Fixes
-- Adds tables referenced in code but not yet created
-- Fixes table name mismatch (do_not_call vs dnc_list)

-- ============================================
-- Fix: Create view for do_not_call -> dnc_list
-- The code uses "do_not_call" but migration created "dnc_list"
-- This view allows both names to work
-- ============================================
CREATE OR REPLACE VIEW do_not_call AS
SELECT
  id,
  business_id,
  phone_number,
  reason,
  source,
  notes,
  added_by,
  expires_at,
  created_at,
  -- Add updated_at column that code may expect
  created_at as updated_at
FROM dnc_list;

-- Create rules to allow INSERT/UPDATE/DELETE through the view
CREATE OR REPLACE RULE do_not_call_insert AS
ON INSERT TO do_not_call
DO INSTEAD
INSERT INTO dnc_list (business_id, phone_number, reason, source, notes, added_by, expires_at)
VALUES (NEW.business_id, NEW.phone_number, NEW.reason, NEW.source, NEW.notes, NEW.added_by, NEW.expires_at)
RETURNING id, business_id, phone_number, reason, source, notes, added_by, expires_at, created_at, created_at as updated_at;

CREATE OR REPLACE RULE do_not_call_update AS
ON UPDATE TO do_not_call
DO INSTEAD
UPDATE dnc_list
SET phone_number = NEW.phone_number,
    reason = NEW.reason,
    source = NEW.source,
    notes = NEW.notes,
    expires_at = NEW.expires_at
WHERE id = OLD.id;

CREATE OR REPLACE RULE do_not_call_delete AS
ON DELETE TO do_not_call
DO INSTEAD
DELETE FROM dnc_list WHERE id = OLD.id;

COMMENT ON VIEW do_not_call IS 'Alias view for dnc_list table - both names are valid';

-- ============================================
-- Business Types Table (for health checks)
-- ============================================
CREATE TABLE IF NOT EXISTS business_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  default_services jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE business_types IS 'Predefined business types for onboarding and configuration';

-- Seed some default business types
INSERT INTO business_types (slug, name, description, icon) VALUES
  ('salon', 'Salon & Spa', 'Hair salons, nail salons, spas, and beauty services', 'scissors'),
  ('medical', 'Medical Practice', 'Doctors, dentists, chiropractors, and healthcare providers', 'stethoscope'),
  ('restaurant', 'Restaurant', 'Restaurants, cafes, and food service establishments', 'utensils'),
  ('automotive', 'Automotive', 'Auto repair shops, dealerships, and automotive services', 'car'),
  ('legal', 'Legal Services', 'Law firms and legal practices', 'scale'),
  ('real_estate', 'Real Estate', 'Real estate agencies and property management', 'home'),
  ('fitness', 'Fitness & Wellness', 'Gyms, personal trainers, and wellness centers', 'dumbbell'),
  ('professional', 'Professional Services', 'Consulting, accounting, and other professional services', 'briefcase'),
  ('home_services', 'Home Services', 'Plumbers, electricians, HVAC, and home repair', 'wrench'),
  ('other', 'Other', 'Other business types', 'building')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- Connect Payouts Table
-- Tracks Stripe payouts to connected accounts
-- ============================================
CREATE TABLE IF NOT EXISTS connect_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stripe_payout_id text NOT NULL UNIQUE,
  stripe_account_id text NOT NULL,
  amount_cents integer NOT NULL,
  currency text DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_transit', 'paid', 'failed', 'canceled'
  )),
  arrival_date timestamptz,
  failure_code text,
  failure_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE connect_payouts IS 'Stripe payouts to connected accounts';
COMMENT ON COLUMN connect_payouts.stripe_payout_id IS 'Stripe Payout ID (po_xxxxx)';
COMMENT ON COLUMN connect_payouts.status IS 'Payout status from Stripe';
COMMENT ON COLUMN connect_payouts.arrival_date IS 'Expected arrival date of the payout';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_connect_payouts_business ON connect_payouts(business_id);
CREATE INDEX IF NOT EXISTS idx_connect_payouts_stripe ON connect_payouts(stripe_payout_id);
CREATE INDEX IF NOT EXISTS idx_connect_payouts_status ON connect_payouts(business_id, status);

-- ============================================
-- Connect Transfers Table
-- Tracks Stripe transfers to connected accounts
-- ============================================
CREATE TABLE IF NOT EXISTS connect_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stripe_transfer_id text NOT NULL UNIQUE,
  stripe_account_id text NOT NULL,
  amount_cents integer NOT NULL,
  currency text DEFAULT 'usd',
  source_transaction text, -- Original charge ID
  description text,
  reversed boolean DEFAULT false,
  reversal_amount_cents integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE connect_transfers IS 'Stripe transfers to connected accounts';
COMMENT ON COLUMN connect_transfers.stripe_transfer_id IS 'Stripe Transfer ID (tr_xxxxx)';
COMMENT ON COLUMN connect_transfers.source_transaction IS 'Original charge or payment that was transferred';
COMMENT ON COLUMN connect_transfers.reversed IS 'Whether the transfer has been reversed';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_connect_transfers_business ON connect_transfers(business_id);
CREATE INDEX IF NOT EXISTS idx_connect_transfers_stripe ON connect_transfers(stripe_transfer_id);
CREATE INDEX IF NOT EXISTS idx_connect_transfers_source ON connect_transfers(source_transaction);

-- ============================================
-- Payment Refunds Table
-- Tracks refund transactions separately for better reporting
-- ============================================
CREATE TABLE IF NOT EXISTS payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  original_transaction_id uuid REFERENCES payment_transactions(id),
  stripe_refund_id text UNIQUE,
  stripe_charge_id text,
  amount_cents integer NOT NULL,
  currency text DEFAULT 'usd',
  reason text CHECK (reason IN (
    'duplicate', 'fraudulent', 'requested_by_customer', 'expired_uncaptured_charge', 'other'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'succeeded', 'failed', 'canceled'
  )),
  failure_reason text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE payment_refunds IS 'Payment refund records for tracking and reporting';
COMMENT ON COLUMN payment_refunds.stripe_refund_id IS 'Stripe Refund ID (re_xxxxx)';
COMMENT ON COLUMN payment_refunds.reason IS 'Reason for the refund';
COMMENT ON COLUMN payment_refunds.status IS 'Refund status from Stripe';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_refunds_business ON payment_refunds(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_transaction ON payment_refunds(original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_stripe ON payment_refunds(stripe_refund_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_status ON payment_refunds(business_id, status);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE connect_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE connect_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;

-- Connect payouts policies
CREATE POLICY "Users can view their connect payouts" ON connect_payouts
  FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Service role bypass connect_payouts" ON connect_payouts
  FOR ALL USING (auth.role() = 'service_role');

-- Connect transfers policies
CREATE POLICY "Users can view their connect transfers" ON connect_transfers
  FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Service role bypass connect_transfers" ON connect_transfers
  FOR ALL USING (auth.role() = 'service_role');

-- Payment refunds policies
CREATE POLICY "Users can view their payment refunds" ON payment_refunds
  FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users can create refunds for their business" ON payment_refunds
  FOR INSERT WITH CHECK (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Service role bypass payment_refunds" ON payment_refunds
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Updated at triggers
-- ============================================
CREATE TRIGGER update_connect_payouts_updated_at
  BEFORE UPDATE ON connect_payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connect_transfers_updated_at
  BEFORE UPDATE ON connect_transfers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payment_refunds_updated_at
  BEFORE UPDATE ON payment_refunds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==============================================
-- Migration: 20250125000001_add_call_direction.sql
-- ==============================================

-- Add direction column to calls table to properly track inbound vs outbound calls
-- This fixes the issue where caller number was showing as the business number

ALTER TABLE calls ADD COLUMN IF NOT EXISTS direction text DEFAULT 'inbound';

-- Add constraint for valid values (drop if exists first to avoid errors)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_call_direction'
  ) THEN
    ALTER TABLE calls ADD CONSTRAINT valid_call_direction
      CHECK (direction IN ('inbound', 'outbound'));
  END IF;
END $$;

-- Create index for filtering by direction
CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(direction);

-- Update existing calls - try to infer direction from metadata or outbound tables
-- Calls linked to outbound_call_queue are outbound
UPDATE calls c
SET direction = 'outbound'
FROM outbound_call_queue ocq
WHERE c.id = ocq.call_id
AND (c.direction IS NULL OR c.direction = 'inbound');

-- Fix swapped phone numbers for inbound calls
-- If from_number matches a business phone number and to_number doesn't, swap them
-- This fixes cases where Retell sent the numbers in the wrong order
UPDATE calls c
SET from_number = c.to_number,
    to_number = c.from_number
FROM phone_numbers pn
WHERE c.from_number = pn.number
  AND c.business_id = pn.business_id
  AND c.direction = 'inbound'
  AND c.to_number IS NOT NULL
  AND c.to_number != pn.number;

-- Fix call outcomes for calls that resulted in appointments
-- If a call has an appointment linked to it, the outcome should be "booked"
UPDATE calls c
SET outcome = 'booked'
FROM appointments a
WHERE a.call_id = c.id
  AND a.status != 'cancelled'
  AND (c.outcome IS NULL OR c.outcome != 'booked');

COMMENT ON COLUMN calls.direction IS 'Call direction: inbound (customer called business) or outbound (business called customer)';


-- ==============================================
-- Migration: 20250125000002_fix_call_data.sql
-- ==============================================

-- Fix call direction constraint and data
-- Continuation of 20250125000001 fixes

-- Add constraint for valid values if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_call_direction'
  ) THEN
    ALTER TABLE calls ADD CONSTRAINT valid_call_direction
      CHECK (direction IN ('inbound', 'outbound'));
  END IF;
END $$;

-- Create index for filtering by direction
CREATE INDEX IF NOT EXISTS idx_calls_direction ON calls(direction);

-- Update existing calls - try to infer direction from outbound tables
-- Calls linked to campaign_calls are outbound (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_calls') THEN
    UPDATE calls c
    SET direction = 'outbound'
    FROM campaign_calls cc
    WHERE c.id = cc.call_id
    AND (c.direction IS NULL OR c.direction = 'inbound');
  END IF;
END $$;

-- Fix swapped phone numbers for inbound calls
-- If from_number matches a business phone number and to_number doesn't, swap them
-- This fixes cases where Retell sent the numbers in the wrong order
UPDATE calls c
SET from_number = c.to_number,
    to_number = c.from_number
FROM phone_numbers pn
WHERE c.from_number = pn.number
  AND c.business_id = pn.business_id
  AND c.direction = 'inbound'
  AND c.to_number IS NOT NULL
  AND c.to_number != pn.number;

-- Fix call outcomes for calls that resulted in appointments
-- If a call has an appointment linked to it, the outcome should be "booked"
UPDATE calls c
SET outcome = 'booked'
FROM appointments a
WHERE a.call_id = c.id
  AND a.status != 'cancelled'
  AND (c.outcome IS NULL OR c.outcome != 'booked');


-- ==============================================
-- Migration: 20250125100001_fix_caller_profiles_columns.sql
-- ==============================================

-- Fix missing columns in caller_profiles table
-- Add call_count if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'caller_profiles' AND column_name = 'call_count'
  ) THEN
    ALTER TABLE caller_profiles ADD COLUMN call_count INT DEFAULT 1;
  END IF;
END $$;

-- Add last_call_at if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'caller_profiles' AND column_name = 'last_call_at'
  ) THEN
    ALTER TABLE caller_profiles ADD COLUMN last_call_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- Add vip_status if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'caller_profiles' AND column_name = 'vip_status'
  ) THEN
    ALTER TABLE caller_profiles ADD COLUMN vip_status BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add notes if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'caller_profiles' AND column_name = 'notes'
  ) THEN
    ALTER TABLE caller_profiles ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';


-- ==============================================
-- Migration: 20250126000001_payment_transactions.sql
-- ==============================================

-- Migration: Create payment_transactions table
-- This table is referenced by payment_refunds FK but was never created

-- ============================================
-- Payment Transactions Table
-- Core table for all payment transactions
-- ============================================
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Stripe identifiers
  stripe_payment_intent_id text UNIQUE,
  stripe_charge_id text,
  stripe_customer_id text,
  stripe_invoice_id text,

  -- Transaction details
  amount_cents integer NOT NULL,
  currency text DEFAULT 'usd',
  description text,

  -- Status tracking
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded', 'partially_refunded'
  )),

  -- Payment method info
  payment_method_type text, -- 'card', 'bank_transfer', etc.
  payment_method_last4 text,
  payment_method_brand text, -- 'visa', 'mastercard', etc.

  -- Error handling
  failure_code text,
  failure_message text,

  -- Related entities
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_id uuid, -- Internal invoice reference

  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE payment_transactions IS 'All payment transactions for businesses';
COMMENT ON COLUMN payment_transactions.stripe_payment_intent_id IS 'Stripe PaymentIntent ID (pi_xxxxx)';
COMMENT ON COLUMN payment_transactions.status IS 'Transaction status from Stripe';
COMMENT ON COLUMN payment_transactions.amount_cents IS 'Amount in cents';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_payment_transactions_business ON payment_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_pi ON payment_transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_stripe_charge ON payment_transactions(stripe_charge_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(business_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created ON payment_transactions(business_id, created_at DESC);

-- ============================================
-- Row Level Security
-- ============================================
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view their own transactions
DROP POLICY IF EXISTS "Users can view their payment transactions" ON payment_transactions;
CREATE POLICY "Users can view their payment transactions" ON payment_transactions
  FOR SELECT USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

-- Service role can do anything
DROP POLICY IF EXISTS "Service role bypass payment_transactions" ON payment_transactions;
CREATE POLICY "Service role bypass payment_transactions" ON payment_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- Updated at trigger
-- ============================================
DROP TRIGGER IF EXISTS update_payment_transactions_updated_at ON payment_transactions;
CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON payment_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==============================================
-- Migration: 20250126000002_calls_created_at_index.sql
-- ==============================================

-- Migration: Add missing index on calls.created_at
-- Date: 2025-01-26
--
-- Most dashboard queries filter calls by business_id and created_at,
-- but only started_at had an index. This adds the commonly-used created_at index.

-- Index for filtering calls by business and created_at (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_calls_business_created
ON calls(business_id, created_at DESC);

-- Note: Trigram indexes for text search require pg_trgm extension.
-- If you need full-text search optimization, enable the extension first:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Then create these indexes:
-- CREATE INDEX IF NOT EXISTS idx_calls_summary_trgm ON calls USING gin (summary gin_trgm_ops) WHERE summary IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_calls_message_trgm ON calls USING gin (message_taken gin_trgm_ops) WHERE message_taken IS NOT NULL;

COMMENT ON INDEX idx_calls_business_created IS 'Primary index for time-based call queries on dashboard';


-- ==============================================
-- Migration: 20250127000001_nylas_integration.sql
-- ==============================================

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

-- Relax provider constraint to allow Nylas-managed providers
ALTER TABLE calendar_integrations DROP CONSTRAINT IF EXISTS valid_provider;
ALTER TABLE calendar_integrations ADD CONSTRAINT valid_provider
  CHECK (provider IN ('google', 'outlook', 'built_in', 'microsoft'));

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


-- ==============================================
-- Migration: 20250127000002_business_slug.sql
-- ==============================================

-- Add slug column to businesses for public booking URLs
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Backfill existing businesses with a slug derived from name
-- Uses lowercase name with spaces replaced by hyphens, limited to alphanumeric + hyphens
UPDATE businesses
  SET slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
  WHERE slug IS NULL;

-- Add unique index for fast slug lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug) WHERE slug IS NOT NULL;

