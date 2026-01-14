-- Migration: Atomic increment function and additional constraints
-- Fixes race condition in usage minutes tracking and adds missing constraints

-- =============================================================================
-- ATOMIC INCREMENT FUNCTION
-- =============================================================================
-- This function atomically increments usage minutes, preventing race conditions
-- where concurrent calls could lose increments.

create or replace function increment_usage_minutes(
  p_business_id uuid,
  p_minutes integer
)
returns table (
  id uuid,
  name text,
  minutes_used_this_cycle integer,
  current_cycle_start date,
  current_cycle_end date
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Validate input: must be positive integer
  if p_minutes <= 0 then
    raise exception 'Minutes must be a positive integer';
  end if;

  -- Validate input: max 24 hours per single increment
  if p_minutes > 1440 then
    raise exception 'Minutes increment exceeds maximum allowed value (1440)';
  end if;

  return query
  update businesses
  set minutes_used_this_cycle = coalesce(minutes_used_this_cycle, 0) + p_minutes
  where businesses.id = p_business_id
  returning
    businesses.id,
    businesses.name,
    businesses.minutes_used_this_cycle,
    businesses.current_cycle_start,
    businesses.current_cycle_end;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function increment_usage_minutes(uuid, integer) to authenticated;

-- =============================================================================
-- ADDITIONAL CONSTRAINTS
-- =============================================================================

-- Add non-negative price constraint to packages (memberships already has this)
alter table packages
  drop constraint if exists valid_package_price;

alter table packages
  add constraint valid_package_price
  check (price_cents is null or price_cents >= 0);

-- Add upper bound constraint for min_visits_to_pitch
alter table packages
  drop constraint if exists valid_min_visits;

alter table packages
  add constraint valid_min_visits
  check (min_visits_to_pitch >= 0 and min_visits_to_pitch <= 1000);

-- Add session_count range (min 2 to match API validation)
alter table packages
  drop constraint if exists valid_session_count_range;

alter table packages
  add constraint valid_session_count_range
  check (session_count >= 2 and session_count <= 100);

-- Add validity_days upper bound
alter table packages
  drop constraint if exists valid_validity_days;

alter table packages
  add constraint valid_validity_days
  check (validity_days is null or (validity_days >= 1 and validity_days <= 365));

-- =============================================================================
-- BUSINESS CONSTRAINTS
-- =============================================================================
-- Ensure minutes_used_this_cycle can never be negative

alter table businesses
  drop constraint if exists valid_minutes_used;

alter table businesses
  add constraint valid_minutes_used
  check (minutes_used_this_cycle is null or minutes_used_this_cycle >= 0);

-- =============================================================================
-- INDEXES FOR ANALYTICS (optional, can be added later if needed)
-- =============================================================================
-- These indexes support sorting by times_offered/times_accepted for analytics

-- Uncomment if analytics queries are slow:
-- create index if not exists idx_upsells_times_offered
--   on upsells(business_id, times_offered desc);
-- create index if not exists idx_bundles_times_offered
--   on bundles(business_id, times_offered desc);
-- create index if not exists idx_packages_times_offered
--   on packages(business_id, times_offered desc);
-- create index if not exists idx_memberships_times_offered
--   on memberships(business_id, times_offered desc);
