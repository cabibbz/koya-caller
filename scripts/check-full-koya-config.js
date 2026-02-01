/**
 * Check FULL Koya config for Netapp
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

const businessId = '5a0a09c7-2050-485a-b803-3fd6d556c534'; // Netapp

async function main() {
  console.log('=== FULL KOYA CONFIG FOR NETAPP ===\n');

  // Business
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  console.log('--- Business ---');
  console.log('Name:', business?.name);
  console.log('Type:', business?.business_type);
  console.log('Differentiator:', business?.differentiator);

  // AI Config
  const { data: aiConfig } = await supabase
    .from('ai_config')
    .select('*')
    .eq('business_id', businessId)
    .single();

  console.log('\n--- AI Config ---');
  console.log('AI Name:', aiConfig?.ai_name);
  console.log('Personality:', aiConfig?.personality);
  console.log('Greeting:', aiConfig?.greeting);
  console.log('Retell Agent ID:', aiConfig?.retell_agent_id);

  // Call Settings
  const { data: callSettings } = await supabase
    .from('call_settings')
    .select('*')
    .eq('business_id', businessId)
    .single();

  console.log('\n--- Call Settings ---');
  console.log('Transfer Number:', callSettings?.transfer_number);
  console.log('After Hours Enabled:', callSettings?.after_hours_enabled);

  console.log('\n=== WHAT THE USER SHOULD CHECK ===');
  console.log('1. Go to Koya Dashboard > Settings > AI Voice');
  console.log('2. Check what greeting is set');
  console.log('3. Make sure it matches what you want the AI to say');
  console.log('4. Click Save - this should trigger auto-sync to Retell');
}

main();
