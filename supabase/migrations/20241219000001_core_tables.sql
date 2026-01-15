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
