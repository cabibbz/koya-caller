/**
 * Check specific Retell call details
 * Run with: node scripts/check-specific-retell-calls.js
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

// Call IDs from database
const callIds = [
  'call_c445e6fdac3574f5576993ad4c6',
  'call_b9163ad89410b31546795b25341',
  'call_93e91ab22fb1bbeb7908c535931',
  'call_e040aff83485be4da5311f336be'
];

async function checkSpecificCalls() {
  console.log('\n========================================');
  console.log('RETELL CALL DETAILS (from your database)');
  console.log('========================================\n');

  if (!retellApiKey) {
    console.log('❌ RETELL_API_KEY not set');
    return;
  }

  const Retell = require('retell-sdk');
  const client = new Retell.default({ apiKey: retellApiKey });

  for (const callId of callIds) {
    console.log(`\nCall: ${callId}`);
    console.log('-'.repeat(50));

    try {
      const call = await client.call.retrieve(callId);

      console.log(`   Type: ${call.call_type}`);
      console.log(`   Status: ${call.call_status}`);
      console.log(`   Agent ID: ${call.agent_id}`);
      console.log(`   Start: ${call.start_timestamp ? new Date(call.start_timestamp).toLocaleString() : 'N/A'}`);
      console.log(`   End: ${call.end_timestamp ? new Date(call.end_timestamp).toLocaleString() : 'N/A'}`);
      console.log(`   Duration: ${call.duration_ms ? (call.duration_ms / 1000).toFixed(1) + 's' : 'N/A'}`);

      if (call.disconnection_reason) {
        console.log(`   ⚠ Disconnect Reason: ${call.disconnection_reason}`);
      }

      if (call.call_analysis) {
        console.log(`   Summary: ${call.call_analysis.call_summary || 'None'}`);
      }

      if (call.transcript) {
        console.log(`   Transcript: ${call.transcript.substring(0, 200)}...`);
      }

      // Show metadata if present
      if (call.metadata) {
        console.log(`   Metadata: ${JSON.stringify(call.metadata)}`);
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  console.log('\n');
}

checkSpecificCalls().catch(console.error);
