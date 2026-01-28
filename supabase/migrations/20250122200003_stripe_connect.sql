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
