/**
 * Check Retell agent configuration
 * Run with: node scripts/check-retell-agent.js
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

// Agent ID from database
const agentId = 'agent_a42afc929376c54d66c010c58a';

async function checkRetellAgent() {
  console.log('\n========================================');
  console.log('RETELL AGENT CHECK');
  console.log('========================================\n');

  if (!retellApiKey) {
    console.log('❌ RETELL_API_KEY not set');
    return;
  }

  console.log(`Agent ID: ${agentId}\n`);

  try {
    const Retell = require('retell-sdk');
    const client = new Retell.default({ apiKey: retellApiKey });

    // Get agent details
    const agent = await client.agent.retrieve(agentId);

    console.log('Agent Configuration:');
    console.log('--------------------');
    console.log(`   Name: ${agent.agent_name || 'Not set'}`);
    console.log(`   Voice ID: ${agent.voice_id || 'Not set'}`);
    console.log(`   Language: ${agent.language || 'Not set'}`);
    console.log(`   Response Engine: ${JSON.stringify(agent.response_engine?.type) || 'Not set'}`);

    if (agent.response_engine?.type === 'retell-llm') {
      console.log(`   LLM ID: ${agent.response_engine.llm_id || 'Not set'}`);
    }

    console.log('\n✓ Agent exists and is accessible!');

    // List recent calls
    console.log('\n\nRecent Retell Calls:');
    console.log('--------------------');

    const calls = await client.call.list({ limit: 5 });

    if (calls.length === 0) {
      console.log('   No recent calls found');
    } else {
      calls.forEach((call, i) => {
        console.log(`\n   Call ${i + 1}:`);
        console.log(`     ID: ${call.call_id}`);
        console.log(`     Status: ${call.call_status}`);
        console.log(`     Type: ${call.call_type}`);
        console.log(`     Started: ${call.start_timestamp ? new Date(call.start_timestamp).toLocaleString() : 'N/A'}`);
        console.log(`     Duration: ${call.duration_ms ? (call.duration_ms / 1000).toFixed(1) + 's' : 'N/A'}`);
        if (call.disconnection_reason) {
          console.log(`     Disconnect Reason: ${call.disconnection_reason}`);
        }
      });
    }

  } catch (error) {
    console.log('❌ Error:', error.message);

    if (error.message.includes('not found') || error.message.includes('404')) {
      console.log('\n❌ PROBLEM: Agent not found!');
      console.log('   The agent ID in the database does not exist in Retell.');
      console.log('   FIX: Create a new agent in Retell and update ai_config.retell_agent_id');
    }
  }

  console.log('\n');
}

checkRetellAgent().catch(console.error);
