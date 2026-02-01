/**
 * Show the FULL Retell LLM prompt for Netapp
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
const retell = new Retell({ apiKey: process.env.RETELL_API_KEY });

const agentId = 'agent_3ee37c31434537f8bc0683ce9b'; // Netapp

async function main() {
  console.log('=== FULL RETELL LLM PROMPT ===\n');

  const agent = await retell.agent.retrieve(agentId);
  const llmId = agent.response_engine?.llm_id;

  if (!llmId) {
    console.log('No LLM ID found!');
    return;
  }

  const llm = await retell.llm.retrieve(llmId);

  console.log('--- Begin Message ---');
  console.log(llm.begin_message || '(not set)');

  console.log('\n--- General Prompt (FULL) ---');
  console.log(llm.general_prompt || '(not set)');

  // Check if prompt uses dynamic variables
  console.log('\n--- Dynamic Variable Check ---');
  const prompt = llm.general_prompt || '';
  const vars = ['outbound_instructions', 'custom_message', 'greeting', 'is_outbound', 'outbound_purpose'];
  vars.forEach(v => {
    const found = prompt.includes(`{{${v}}}`);
    console.log(`  {{${v}}}: ${found ? '✓ FOUND' : '✗ NOT FOUND'}`);
  });
}

main().catch(console.error);
