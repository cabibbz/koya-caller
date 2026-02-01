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
