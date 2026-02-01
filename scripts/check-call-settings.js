/**
 * Check call settings including DTMF configuration
 */

const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '..', '.env.local');
const content = fs.readFileSync(envPath, 'utf-8');
content.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) return;
  let value = trimmed.substring(eqIndex + 1);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[trimmed.substring(0, eqIndex)] = value;
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('='.repeat(60));
  console.log('Call Settings Check');
  console.log('='.repeat(60));

  // Get all call settings
  const { data: settings, error } = await supabase
    .from('call_settings')
    .select('*');

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  for (const s of settings) {
    console.log(`\nBusiness: ${s.business_id?.slice(0,8)}...`);
    console.log(`  DTMF Enabled: ${s.dtmf_enabled}`);
    console.log(`  DTMF Termination Key: ${s.dtmf_termination_key || '#'}`);
    console.log(`  DTMF Digit Limit: ${s.dtmf_digit_limit || 10}`);
    console.log(`  DTMF Timeout: ${s.dtmf_timeout_ms || 5000}ms`);
    console.log(`  Transfer Number: ${s.transfer_number || 'Not set'}`);
    console.log(`  Voicemail Detection: ${s.voicemail_detection_enabled}`);
  }
}

check().catch(console.error);
