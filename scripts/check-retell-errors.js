/**
 * Check recent Retell calls for errors
 */

const fs = require('fs');
const path = require('path');

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
    if ((value.startsWith('"') && value.endsWith('"'))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}
loadEnv();

const retellApiKey = process.env.RETELL_API_KEY;

async function check() {
  console.log('\n========================================');
  console.log('RECENT RETELL CALLS');
  console.log('========================================\n');

  const Retell = require('retell-sdk');
  const client = new Retell.default({ apiKey: retellApiKey });

  try {
    const calls = await client.call.list({ limit: 10 });

    if (calls.length === 0) {
      console.log('No recent calls found');
      return;
    }

    calls.forEach((call, i) => {
      console.log(`Call ${i + 1}: ${call.call_id}`);
      console.log(`  Type: ${call.call_type}`);
      console.log(`  Status: ${call.call_status}`);
      console.log(`  Started: ${call.start_timestamp ? new Date(call.start_timestamp).toLocaleString() : 'N/A'}`);

      if (call.disconnection_reason) {
        console.log(`  ⚠️ Disconnect Reason: ${call.disconnection_reason}`);
      }

      if (call.call_status === 'error') {
        console.log(`  ❌ ERROR CALL`);
      }

      // Check for any error info
      if (call.error_message) {
        console.log(`  Error Message: ${call.error_message}`);
      }

      console.log('');
    });

  } catch (e) {
    console.log('Error:', e.message);
  }
}

check().catch(console.error);
