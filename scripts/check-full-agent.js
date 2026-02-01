/**
 * Get full Retell agent details for debugging
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
const client = new Retell({ apiKey: process.env.RETELL_API_KEY });

async function main() {
  const agentId = 'agent_3ee37c31434537f8bc0683ce9b';

  console.log('Fetching full agent details...\n');

  try {
    const agent = await client.agent.retrieve(agentId);

    console.log('='.repeat(60));
    console.log('AGENT CONFIGURATION');
    console.log('='.repeat(60));
    console.log(JSON.stringify(agent, null, 2));

    if (agent.response_engine?.llm_id) {
      console.log('\n' + '='.repeat(60));
      console.log('LLM CONFIGURATION');
      console.log('='.repeat(60));

      const llm = await client.llm.retrieve(agent.response_engine.llm_id);
      console.log(JSON.stringify(llm, null, 2));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
