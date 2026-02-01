-- Seed: Plans Table
-- Spec Reference: Part 1, Lines 18-24; Part 2, Lines 91-114
-- Pricing: Starter $99, Professional $197, Business $397

insert into plans (slug, name, price_cents, included_minutes, features, sort_order, is_active) values
(
  'starter',
  'Starter',
  9900, -- $99/month
  200, -- ~40 calls
  '["24/7 AI answering", "Appointment booking", "Custom FAQs", "Message taking", "English + Spanish"]'::jsonb,
  1,
  true
),
(
  'professional',
  'Professional',
  19700, -- $197/month
  800, -- ~160 calls
  '["Everything in Starter", "SMS alerts", "Call recordings", "Analytics"]'::jsonb,
  2,
  true
),
(
  'business',
  'Business',
  39700, -- $397/month
  2000, -- ~400 calls
  '["Everything in Professional", "Priority support", "Custom integrations"]'::jsonb,
  3,
  true
);

-- Note: stripe_price_id will be updated after creating products in Stripe
