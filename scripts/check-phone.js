/**
 * Check phone number configuration
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env
const envPath = path.join(__dirname, '..', '.env.local');
const content = fs.readFileSync(envPath, 'utf-8');
content.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) return;
  const key = trimmed.substring(0, eqIndex);
  let value = trimmed.substring(eqIndex + 1);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('\n========================================');
  console.log('PHONE NUMBER CHECK');
  console.log('========================================\n');

  const { data: phones } = await supabase.from('phone_numbers').select('*');
  console.log('Phone Numbers:');
  if (phones && phones.length > 0) {
    phones.forEach(p => {
      console.log(`  Number: ${p.number}`);
      console.log(`  Business ID: ${p.business_id}`);
      console.log(`  Active: ${p.is_active}`);
      console.log(`  Twilio SID: ${p.twilio_sid || 'NOT SET'}`);
      console.log('');
    });
  } else {
    console.log('  ❌ No phone numbers found!');
  }

  // Check if Twilio webhook URLs are set correctly
  console.log('Expected webhook configuration:');
  console.log('  Voice URL: https://your-domain.com/api/retell/incoming');
  console.log('  Fallback URL: https://your-domain.com/api/twilio/fallback');
}

check();
