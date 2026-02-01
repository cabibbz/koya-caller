/**
 * Check if phone number is properly mapped to a business
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
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER || '+14074568607';

  console.log('Checking phone number mapping...\n');
  console.log('Looking for:', phoneNumber);

  // Check phone_numbers table
  const { data: phones, error: phoneErr } = await supabase
    .from('phone_numbers')
    .select('*')
    .limit(10);

  console.log('\n=== All Phone Numbers in Database ===');
  if (phoneErr) {
    console.log('Error:', phoneErr.message);
  } else if (!phones || phones.length === 0) {
    console.log('No phone numbers found in table!');
  } else {
    console.log('Found', phones.length, 'phone numbers:');
    phones.forEach(p => {
      const num = p.number || p.phone_number || 'unknown';
      const active = p.is_active ? 'active' : 'inactive';
      console.log(`  ${num} -> business: ${p.business_id} (${active})`);
    });
  }

  // Check AI config
  console.log('\n=== AI Configs with Retell Agents ===');
  const { data: configs, error: configErr } = await supabase
    .from('ai_config')
    .select('business_id, retell_agent_id')
    .not('retell_agent_id', 'is', null);

  if (configErr) {
    console.log('Error:', configErr.message);
  } else {
    configs.forEach(c => console.log(`  Business ${c.business_id} -> Agent ${c.retell_agent_id}`));
  }

  // Check if phone is mapped correctly
  const phoneWithoutPlus = phoneNumber.replace('+', '');
  const { data: match } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('number', phoneNumber);

  const { data: match2 } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('number', phoneWithoutPlus);

  console.log('\n=== Phone Number Match Check ===');
  console.log('Looking for:', phoneNumber, 'or', phoneWithoutPlus);

  const found = match?.[0] || match2?.[0];
  if (found) {
    console.log('FOUND! Business ID:', found.business_id);
    console.log('Active:', found.is_active);
  } else {
    console.log('NOT FOUND in database!');
    console.log('\nThe incoming call handler looks up the phone by the "number" column.');
    console.log('Make sure the phone number exists with is_active=true');
  }
}

main();
