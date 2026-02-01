/**
 * Check database state for debugging
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
  console.log('Database State Check');
  console.log('='.repeat(60));

  // Check businesses
  const { data: businesses, error: bizErr } = await supabase
    .from('businesses')
    .select('id, name, subscription_status')
    .limit(5);
  console.log('\nBusinesses:');
  if (bizErr) {
    console.log('  Error:', bizErr.message);
  } else {
    businesses.forEach(b => console.log(`  - ${b.name} (${b.id.slice(0,8)}...) [${b.subscription_status}]`));
  }

  // Check phone numbers
  const { data: phones, error: phoneErr } = await supabase
    .from('phone_numbers')
    .select('phone_number, business_id, is_active, number')
    .limit(5);
  console.log('\nPhone Numbers:');
  if (phoneErr) {
    console.log('  Error:', phoneErr.message);
  } else {
    phones.forEach(p => console.log(`  - ${p.phone_number || p.number} -> business ${p.business_id?.slice(0,8)}... (active: ${p.is_active})`));
  }

  // Check recent calls
  const { data: calls, error: callErr } = await supabase
    .from('calls')
    .select('id, business_id, retell_call_id, outcome, from_number, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('\nRecent Calls:');
  if (callErr) {
    console.log('  Error:', callErr.message);
  } else if (calls.length === 0) {
    console.log('  No calls found');
  } else {
    calls.forEach(c => {
      const time = new Date(c.created_at).toLocaleTimeString();
      console.log(`  - ${time}: from ${c.from_number || 'unknown'} -> outcome: ${c.outcome || 'pending'}`);
    });
  }

  // Check AI config
  const { data: aiConfigs, error: aiErr } = await supabase
    .from('ai_config')
    .select('business_id, retell_agent_id')
    .not('retell_agent_id', 'is', null);
  console.log('\nAI Configs with Retell Agents:');
  if (aiErr) {
    console.log('  Error:', aiErr.message);
  } else {
    aiConfigs.forEach(c => console.log(`  - Business ${c.business_id?.slice(0,8)}... -> Agent ${c.retell_agent_id}`));
  }
}

check().catch(console.error);
