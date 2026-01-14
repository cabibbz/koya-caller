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
