/**
 * Check what's configured in Koya vs what Retell has
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
  console.log('=== KOYA DASHBOARD CONFIG FOR NETAPP ===\n');

  // Get AI config
  const { data: aiConfig } = await supabase
    .from('ai_config')
    .select('*')
    .eq('business_id', businessId)
    .single();

  console.log('AI Name:', aiConfig?.ai_name);
  console.log('Personality:', aiConfig?.personality);
  console.log('Greeting:', aiConfig?.greeting || '(not set)');
  console.log('Retell Agent ID:', aiConfig?.retell_agent_id);

  console.log('\n--- Stored System Prompt (first 500 chars) ---');
  console.log(aiConfig?.system_prompt?.substring(0, 500) || '(no prompt stored)');

  // Get the actual Retell agent config
  if (aiConfig?.retell_agent_id) {
    console.log('\n=== ACTUAL RETELL AGENT CONFIG ===\n');

    const agent = await retell.agent.retrieve(aiConfig.retell_agent_id);
    console.log('Agent Name:', agent.agent_name);
    console.log('Voice ID:', agent.voice_id);
    console.log('LLM ID:', agent.response_engine?.llm_id);

    // Get the LLM to see the actual prompt
    if (agent.response_engine?.llm_id) {
      const llm = await retell.llm.retrieve(agent.response_engine.llm_id);
      console.log('\n--- Retell LLM General Prompt (first 800 chars) ---');
      console.log(llm.general_prompt?.substring(0, 800) || '(no prompt)');

      console.log('\n--- Begin Message (what AI says first) ---');
      console.log(llm.begin_message || '(not set - AI waits for caller)');
    }
  }
}

main().catch(console.error);
