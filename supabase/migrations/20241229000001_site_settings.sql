-- Migration: Site Settings
-- Configurable settings for landing page stats and pricing

-- ============================================
-- Site Settings Table
-- Key-value store for site-wide settings
-- ============================================
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  category TEXT NOT NULL DEFAULT 'general', -- 'stats', 'pricing', 'general'
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_site_settings_key ON site_settings(key);
CREATE INDEX idx_site_settings_category ON site_settings(category);

COMMENT ON TABLE site_settings IS 'Site-wide configurable settings for landing page';

-- ============================================
-- Default Settings Data
-- ============================================

-- Landing Page Stats
INSERT INTO site_settings (key, value, category, description) VALUES
  ('stats_calls_today', '{"value": 2847, "label": "Calls Handled Today"}', 'stats', 'Live counter for calls handled today'),
  ('stats_total_calls', '{"value": 2147892, "suffix": "+", "label": "Total Calls Answered"}', 'stats', 'Total calls answered all time'),
  ('stats_businesses', '{"value": 10847, "suffix": "+", "label": "Businesses Trust Us"}', 'stats', 'Number of businesses using Koya'),
  ('stats_uptime', '{"value": 99.9, "suffix": "%", "label": "Uptime Guaranteed"}', 'stats', 'Service uptime percentage')
ON CONFLICT (key) DO NOTHING;

-- Pricing Plans
INSERT INTO site_settings (key, value, category, description) VALUES
  ('pricing_starter', '{
    "name": "Starter",
    "price": 49,
    "period": "month",
    "description": "Perfect for small businesses just getting started",
    "minutes": 100,
    "features": [
      "100 minutes/month",
      "1 phone number",
      "Basic call handling",
      "Email support",
      "Standard voice"
    ],
    "highlighted": false,
    "cta": "Start Free Trial"
  }', 'pricing', 'Starter plan configuration'),

  ('pricing_professional', '{
    "name": "Professional",
    "price": 149,
    "period": "month",
    "description": "For growing businesses that need more",
    "minutes": 500,
    "features": [
      "500 minutes/month",
      "2 phone numbers",
      "Advanced call routing",
      "Priority support",
      "Premium voices",
      "Calendar integration",
      "Custom greeting"
    ],
    "highlighted": true,
    "badge": "Most Popular",
    "cta": "Start Free Trial"
  }', 'pricing', 'Professional plan configuration'),

  ('pricing_enterprise', '{
    "name": "Enterprise",
    "price": 399,
    "period": "month",
    "description": "For businesses with high call volumes",
    "minutes": 2000,
    "features": [
      "2000 minutes/month",
      "5 phone numbers",
      "Multi-location support",
      "Dedicated account manager",
      "Custom AI training",
      "API access",
      "White-label options",
      "99.99% SLA"
    ],
    "highlighted": false,
    "cta": "Contact Sales"
  }', 'pricing', 'Enterprise plan configuration')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read site settings (for landing page)
CREATE POLICY "Anyone can read site settings"
  ON site_settings
  FOR SELECT
  TO anon, authenticated
  USING (TRUE);

-- Only admins can update
CREATE POLICY "Admins can update site settings"
  ON site_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins can insert site settings"
  ON site_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins can delete site settings"
  ON site_settings
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user());
