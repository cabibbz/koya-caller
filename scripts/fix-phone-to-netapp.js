/**
 * Update phone number to point to Netapp business
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

async function main() {
  const netappBusinessId = '5a0a09c7-2050-485a-b803-3fd6d556c534';
  const phoneNumber = '+14074568607';

  console.log('Updating phone number to point to Netapp...\n');

  const { error } = await supabase
    .from('phone_numbers')
    .update({ business_id: netappBusinessId })
    .eq('number', phoneNumber);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('✓ Phone number now linked to Netapp business');

  // Verify
  const { data } = await supabase
    .from('phone_numbers')
    .select('number, business_id')
    .eq('number', phoneNumber)
    .single();

  console.log('Verification:', data);
  console.log('\nTry calling again!');
}

main();
