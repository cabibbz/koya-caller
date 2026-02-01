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
