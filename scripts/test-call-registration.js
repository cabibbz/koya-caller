/**
 * Test Retell call registration to see if it works
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
  console.log('Testing Retell call registration...\n');

  const agentId = 'agent_3ee37c31434537f8bc0683ce9b';
  const fromNumber = '+14074568607';
  const toNumber = '+14074568607';

  try {
    console.log('Attempting to register a test phone call...');
    console.log(`  Agent ID: ${agentId}`);
    console.log(`  From: ${fromNumber}`);
    console.log(`  To: ${toNumber}\n`);

    const result = await client.call.registerPhoneCall({
      agent_id: agentId,
      from_number: fromNumber,
      to_number: toNumber,
      direction: 'inbound',
      metadata: {
        test: 'true',
        business_id: '5a0a09c7-test',
      },
    });

    console.log('✓ Call registration successful!');
    console.log(`  Call ID: ${result.call_id}`);
    console.log(`  SIP URI would be: sip:${result.call_id}@5t4n6j0wnrl.sip.livekit.cloud`);

  } catch (err) {
    console.log('✗ Call registration FAILED!');
    console.log(`  Error: ${err.message}`);
    if (err.response) {
      console.log(`  Status: ${err.response.status}`);
      console.log(`  Body: ${JSON.stringify(err.response.data || err.response.body)}`);
    }
    console.log('\nFull error:', err);
  }
}

main();
