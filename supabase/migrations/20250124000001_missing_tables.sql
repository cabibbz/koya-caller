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
