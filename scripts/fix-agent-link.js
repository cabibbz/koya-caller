/**
 * Fix Retell agent link in database
 * Run with: node scripts/fix-agent-link.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manually load .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const content = fs.readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.substring(0, eqIndex);
    let value = trimmed.substring(eqIndex + 1);

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// The working Retell agent ID
const RETELL_AGENT_ID = 'agent_a42afc929376c54d66c010c58a';

async function fixAgentLink() {
  console.log('\n========================================');
  console.log('FIX RETELL AGENT LINK');
  console.log('========================================\n');

  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Missing Supabase credentials');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get all businesses
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('id, name');

  if (bizError) {
    console.log('❌ Error fetching businesses:', bizError.message);
    return;
  }

  console.log('Businesses found:', businesses.length);
  businesses.forEach(b => console.log(`  - ${b.id}: ${b.name}`));

  // Get current ai_config
  const { data: configs, error: configError } = await supabase
    .from('ai_config')
    .select('business_id, retell_agent_id, voice_id');

  console.log('\nCurrent AI Configs:');
  if (configs && configs.length > 0) {
    configs.forEach(c => console.log(`  - Business: ${c.business_id}, Agent: ${c.retell_agent_id || 'NULL'}`));
  } else {
    console.log('  No configs found');
  }

  // Update or insert ai_config for each business
  for (const business of businesses) {
    console.log(`\nUpdating business: ${business.name} (${business.id})`);

    const { error: upsertError } = await supabase
      .from('ai_config')
      .upsert({
        business_id: business.id,
        retell_agent_id: RETELL_AGENT_ID,
        voice_id: '11labs-Jenny',
        personality: 'friendly',
        ai_name: 'Koya',
        greeting: `Thanks for calling ${business.name}. This is Koya, how can I help you today?`,
        spanish_enabled: false,
        language_mode: 'auto',
      }, { onConflict: 'business_id' });

    if (upsertError) {
      console.log(`  ❌ Error: ${upsertError.message}`);
    } else {
      console.log(`  ✓ Linked to agent ${RETELL_AGENT_ID}`);
    }
  }

  // Verify
  const { data: newConfigs } = await supabase
    .from('ai_config')
    .select('business_id, retell_agent_id');

  console.log('\nUpdated AI Configs:');
  newConfigs.forEach(c => console.log(`  - Business: ${c.business_id}, Agent: ${c.retell_agent_id}`));

  console.log('\n✓ Done! Try calling your number now.');
}

fixAgentLink().catch(console.error);
