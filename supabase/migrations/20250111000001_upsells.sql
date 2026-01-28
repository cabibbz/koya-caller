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
