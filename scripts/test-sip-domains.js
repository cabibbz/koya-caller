/**
 * Test which SIP domain works for Retell
 * Run with: node scripts/test-sip-domains.js
 */

const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;

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

async function testDomains() {
  console.log('\n========================================');
  console.log('RETELL SIP DOMAIN CHECK');
  console.log('========================================\n');

  const domains = [
    'sip.retellai.com',
    '5t4n6j0wnrl.sip.livekit.cloud',
  ];

  for (const domain of domains) {
    console.log(`Testing: ${domain}`);
    try {
      const addresses = await dns.resolve4(domain);
      console.log(`  ✅ Resolves to: ${addresses.join(', ')}`);
    } catch (e) {
      console.log(`  ❌ DNS resolution failed: ${e.code}`);
    }
  }

  // Now test registerPhoneCall with full parameters
  console.log('\n========================================');
  console.log('REGISTER PHONE CALL TEST');
  console.log('========================================\n');

  const retellApiKey = process.env.RETELL_API_KEY;
  const agentId = 'agent_a42afc929376c54d66c010c58a';

  const Retell = require('retell-sdk');
  const client = new Retell.default({ apiKey: retellApiKey });

  try {
    // Try with direction parameter
    const response = await client.call.registerPhoneCall({
      agent_id: agentId,
      from_number: '+14074568607',
      to_number: '+14074501913',
      direction: 'inbound',  // Specify direction
      metadata: {
        test: 'sip-domain-check'
      }
    });

    console.log('Register call response:');
    console.log(JSON.stringify(response, null, 2));

    console.log('\n\nSIP URIs to try:');
    console.log(`1. sip:${response.call_id}@sip.retellai.com`);
    console.log(`2. sip:${response.call_id}@sip.retellai.com;transport=tcp`);
    console.log(`3. sip:${response.call_id}@5t4n6j0wnrl.sip.livekit.cloud`);
    console.log(`4. sip:${response.call_id}@5t4n6j0wnrl.sip.livekit.cloud;transport=tcp`);

  } catch (e) {
    console.log('Error:', e.message);
    if (e.body) console.log('Body:', e.body);
  }
}

testDomains().catch(console.error);
