/**
 * Full sync from Koya to Retell - including greeting/begin_message
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
const Retell = require('retell-sdk').default;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const retell = new Retell({ apiKey: process.env.RETELL_API_KEY });

const businessId = '5a0a09c7-2050-485a-b803-3fd6d556c534'; // Netapp

async function main() {
  console.log('=== FULL SYNC TO RETELL ===\n');

  // Get business
  const { data: business } = await supabase
    .from('businesses')
    .select('name')
    .eq('id', businessId)
    .single();

  console.log('Business:', business?.name);

  // Get AI config with stored prompt
  const { data: aiConfig } = await supabase
    .from('ai_config')
    .select('ai_name, greeting, system_prompt, retell_agent_id')
    .eq('business_id', businessId)
    .single();

  console.log('AI Name:', aiConfig?.ai_name);
  console.log('Greeting:', aiConfig?.greeting);
  console.log('Agent ID:', aiConfig?.retell_agent_id);

  if (!aiConfig?.retell_agent_id) {
    console.log('\nNo Retell agent linked!');
    return;
  }

  // Get the agent
  const agent = await retell.agent.retrieve(aiConfig.retell_agent_id);
  const llmId = agent.response_engine?.llm_id;

  if (!llmId) {
    console.log('\nNo LLM ID on agent!');
    return;
  }

  console.log('LLM ID:', llmId);

  // Build the greeting - use from DB or generate default
  let greeting = aiConfig.greeting;
  if (!greeting) {
    greeting = `Thanks for calling ${business?.name || 'us'}, this is ${aiConfig?.ai_name || 'Koya'}, how can I help you today?`;
  }

  console.log('\n--- Syncing to Retell ---');
  console.log('New begin_message:', greeting);

  // Update the LLM with both prompt AND begin_message
  await retell.llm.update(llmId, {
    general_prompt: aiConfig.system_prompt,
    begin_message: greeting,
  });

  // Also update agent name to match business
  await retell.agent.update(aiConfig.retell_agent_id, {
    agent_name: `${business?.name} - ${aiConfig?.ai_name || 'Koya'}`,
  });

  console.log('\n✓ Synced successfully!');
  console.log('  - Updated LLM prompt');
  console.log('  - Updated begin_message (greeting)');
  console.log('  - Updated agent name');

  // Verify
  const updatedLlm = await retell.llm.retrieve(llmId);
  console.log('\n--- Verification ---');
  console.log('Begin Message now:', updatedLlm.begin_message);
}

main().catch(console.error);
