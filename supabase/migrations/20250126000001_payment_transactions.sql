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
