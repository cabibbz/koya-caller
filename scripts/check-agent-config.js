/**
 * Check Retell agent configuration
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
  const key = trimmed.substring(0, eqIndex);
  let value = trimmed.substring(eqIndex + 1);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[key] = value;
});

const Retell = require('retell-sdk').default;
const { createClient } = require('@supabase/supabase-js');

const client = new Retell({ apiKey: process.env.RETELL_API_KEY });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAgent() {
  // Get agent IDs from database
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
    console.log('\n' + '='.repeat(60));
    console.log('Agent:', agentId);
    console.log('='.repeat(60));

    try {
      const agent = await client.agent.retrieve(agentId);
      console.log('Webhook URL:', agent.webhook_url || 'NOT SET');
      console.log('LLM ID:', agent.response_engine?.llm_id || 'N/A');

      if (agent.response_engine?.llm_id) {
        const llm = await client.llm.retrieve(agent.response_engine.llm_id);
        console.log('\nConfigured Tools:');
        if (llm.general_tools && llm.general_tools.length > 0) {
          llm.general_tools.forEach((tool, i) => {
            console.log(`  ${i + 1}. ${tool.name} (${tool.type})`);
            if (tool.url) console.log(`     URL: ${tool.url}`);
          });
        } else {
          console.log('  No tools configured');
        }
      }
    } catch (err) {
      console.log('Error:', err.message);
    }
  }
}

checkAgent();
