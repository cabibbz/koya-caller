const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://gykyxmgnwkxnatzbvvwu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd5a3l4bWdud2t4bmF0emJ2dnd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjIwMjcxNCwiZXhwIjoyMDgxNzc4NzE0fQ.gHDwQ3C0svuyBBQsgjtS7jXIPmPh8x907HRk04cNuqM'
);

async function createTable() {
  console.log('Creating site_settings table via REST API...\n');

  // First check if we can access any table
  const { data: testData, error: testError } = await supabase
    .from('businesses')
    .select('id')
    .limit(1);

  if (testError) {
    console.log('Test query error:', testError.message);
  } else {
    console.log('Database connection works, businesses table exists');
  }

  // Try to insert directly - if table exists this will work
  const settings = [
    {
      key: 'stats_calls_today',
      value: { value: 2847, label: 'Calls Handled Today' },
      category: 'stats',
      description: 'Live counter for calls handled today'
    },
    {
      key: 'stats_total_calls',
      value: { value: 2147892, suffix: '+', label: 'Total Calls Answered' },
      category: 'stats',
      description: 'Total calls answered all time'
    },
    {
      key: 'stats_businesses',
      value: { value: 10847, suffix: '+', label: 'Businesses Trust Us' },
      category: 'stats',
      description: 'Number of businesses using Koya'
    },
    {
      key: 'stats_uptime',
      value: { value: 99.9, suffix: '%', label: 'Uptime Guaranteed' },
      category: 'stats',
      description: 'Service uptime percentage'
    },
    {
      key: 'pricing_starter',
      value: {
        name: 'Starter',
        price: 49,
        period: 'month',
        description: 'Perfect for small businesses just getting started',
        minutes: 100,
        features: ['100 minutes/month', '1 phone number', 'Basic call handling', 'Email support', 'Standard voice'],
        highlighted: false,
        cta: 'Start Free Trial'
      },
      category: 'pricing',
      description: 'Starter plan configuration'
    },
    {
      key: 'pricing_professional',
      value: {
        name: 'Professional',
        price: 149,
        period: 'month',
        description: 'For growing businesses that need more',
        minutes: 500,
        features: ['500 minutes/month', '2 phone numbers', 'Advanced call routing', 'Priority support', 'Premium voices', 'Calendar integration', 'Custom greeting'],
        highlighted: true,
        badge: 'Most Popular',
        cta: 'Start Free Trial'
      },
      category: 'pricing',
      description: 'Professional plan configuration'
    },
    {
      key: 'pricing_enterprise',
      value: {
        name: 'Enterprise',
        price: 399,
        period: 'month',
        description: 'For businesses with high call volumes',
        minutes: 2000,
        features: ['2000 minutes/month', '5 phone numbers', 'Multi-location support', 'Dedicated account manager', 'Custom AI training', 'API access', 'White-label options', '99.99% SLA'],
        highlighted: false,
        cta: 'Contact Sales'
      },
      category: 'pricing',
      description: 'Enterprise plan configuration'
    }
  ];

  // Try to insert into site_settings
  const { data, error } = await supabase
    .from('site_settings')
    .upsert(settings, { onConflict: 'key' });

  if (error) {
    console.log('\n❌ Error:', error.message);
    console.log('\nThe site_settings table does not exist.');
    console.log('\n========================================');
    console.log('Please run this SQL in Supabase SQL Editor:');
    console.log('========================================\n');
    console.log(`
CREATE TABLE site_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read" ON site_settings FOR SELECT USING (TRUE);
CREATE POLICY "Service role can modify" ON site_settings FOR ALL USING (TRUE);
`);
    console.log('========================================');
    console.log('After running the SQL, run this script again.');
  } else {
    console.log('\n✅ SUCCESS! Site settings inserted.');
    console.log('Inserted', settings.length, 'settings');
  }
}

createTable();
