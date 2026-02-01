/**
 * Fix Retell agent DTMF settings
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

const Retell = require('retell-sdk').default;
const { createClient } = require('@supabase/supabase-js');

const client = new Retell({ apiKey: process.env.RETELL_API_KEY });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('Fixing Retell agent DTMF settings...\n');

  // Get all agent IDs
  const { data: configs } = await supabase
    .from('ai_config')
    .select('business_id, retell_agent_id, retell_agent_id_spanish')
    .not('retell_agent_id', 'is', null);

  const agentIds = new Set();
  for (const config of configs || []) {
    if (config.retell_agent_id) agentIds.add(config.retell_agent_id);
    if (config.retell_agent_id_spanish) agentIds.add(config.retell_agent_id_spanish);
  }

  for (const agentId of agentIds) {
    console.log(`Fixing agent ${agentId}...`);

    try {
      // Disable DTMF completely since it's not being used properly
      await client.agent.update(agentId, {
        allow_user_dtmf: false,
      });

      console.log(`  ✓ Disabled DTMF for agent\n`);
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}\n`);
    }
  }

  console.log('Done! DTMF has been disabled for all agents.');
  console.log('Try making a call again - pressing # should no longer cause issues.');
}

main();
