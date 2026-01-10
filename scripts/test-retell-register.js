/**
 * Test Retell registerPhoneCall to see what it returns
 * Run with: node scripts/test-retell-register.js
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

async function testRegisterPhoneCall() {
  console.log('\n========================================');
  console.log('TEST RETELL registerPhoneCall RESPONSE');
  console.log('========================================\n');

  if (!retellApiKey) {
    console.log('❌ RETELL_API_KEY not set');
    return;
  }

  const Retell = require('retell-sdk');
  const client = new Retell.default({ apiKey: retellApiKey });

  try {
    // Register a test call
    const response = await client.call.registerPhoneCall({
      agent_id: agentId,
      from_number: '+14074568607',
      to_number: '+14074501913',
      metadata: {
        test: 'true'
      }
    });

    console.log('Full response from registerPhoneCall:');
    console.log('--------------------------------------');
    console.log(JSON.stringify(response, null, 2));

    console.log('\nKey fields:');
    console.log(`  call_id: ${response.call_id}`);
    console.log(`  agent_id: ${response.agent_id}`);

    // Check if there's any SIP-related info
    if (response.sip_trunk_id) {
      console.log(`  sip_trunk_id: ${response.sip_trunk_id}`);
    }

    // Look for any URL or endpoint info
    Object.keys(response).forEach(key => {
      if (key.includes('url') || key.includes('endpoint') || key.includes('sip') || key.includes('uri')) {
        console.log(`  ${key}: ${response[key]}`);
      }
    });

  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.response) {
      console.log('Response:', error.response.data);
    }
  }

  console.log('\n');
}

testRegisterPhoneCall().catch(console.error);
