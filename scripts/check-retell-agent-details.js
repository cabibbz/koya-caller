/**
 * Get detailed Retell agent configuration
 * Run with: node scripts/check-retell-agent-details.js
 */

const fs = require('fs');
const path = require('path');

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

const retellApiKey = process.env.RETELL_API_KEY;
const agentId = 'agent_a42afc929376c54d66c010c58a';

async function checkAgent() {
  console.log('\n========================================');
  console.log('RETELL AGENT FULL DETAILS');
  console.log('========================================\n');

  const Retell = require('retell-sdk');
  const client = new Retell.default({ apiKey: retellApiKey });

  try {
    const agent = await client.agent.retrieve(agentId);

    console.log('Full agent configuration:');
    console.log(JSON.stringify(agent, null, 2));

    console.log('\n\nKey settings to check:');
    console.log('----------------------');
    console.log(`Agent ID: ${agent.agent_id}`);
    console.log(`Agent Name: ${agent.agent_name}`);
    console.log(`Voice ID: ${agent.voice_id}`);
    console.log(`Language: ${agent.language}`);

    if (agent.response_engine) {
      console.log(`Response Engine Type: ${agent.response_engine.type}`);
      if (agent.response_engine.llm_id) {
        console.log(`LLM ID: ${agent.response_engine.llm_id}`);
      }
    }

    // Check for any inbound/telephony specific settings
    if (agent.enable_transcription_formatting !== undefined) {
      console.log(`Transcription Formatting: ${agent.enable_transcription_formatting}`);
    }

    // Check if there's anything about call handling
    console.log('\nLooking for call/telephony settings...');
    const relevantKeys = Object.keys(agent).filter(k =>
      k.includes('call') ||
      k.includes('phone') ||
      k.includes('sip') ||
      k.includes('inbound') ||
      k.includes('outbound')
    );

    if (relevantKeys.length > 0) {
      relevantKeys.forEach(k => {
        console.log(`  ${k}: ${JSON.stringify(agent[k])}`);
      });
    } else {
      console.log('  No specific call/telephony settings found');
    }

    // Also get the LLM config if using retell-llm
    if (agent.response_engine?.type === 'retell-llm' && agent.response_engine?.llm_id) {
      console.log('\n\nLLM Configuration:');
      console.log('------------------');
      try {
        const llm = await client.llm.retrieve(agent.response_engine.llm_id);
        console.log(`LLM ID: ${llm.llm_id}`);
        console.log(`Model: ${llm.model}`);
        console.log(`General Prompt (first 200 chars): ${(llm.general_prompt || '').substring(0, 200)}...`);
      } catch (e) {
        console.log(`Could not fetch LLM config: ${e.message}`);
      }
    }

  } catch (e) {
    console.log('Error:', e.message);
  }
}

checkAgent().catch(console.error);
