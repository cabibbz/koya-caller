/**
 * Check recent Retell calls
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.substring(0, eqIndex);
    let value = trimmed.substring(eqIndex + 1);
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}
loadEnv();

const Retell = require('retell-sdk');
const client = new Retell.default({ apiKey: process.env.RETELL_API_KEY });

async function main() {
  const calls = await client.call.list({ limit: 10 });
  console.log('Recent Retell calls:\n');

  for (const c of calls) {
    console.log(`Call: ${c.call_id}`);
    console.log(`  Status: ${c.call_status}`);
    console.log(`  Type: ${c.call_type}`);
    console.log(`  Duration: ${c.end_timestamp && c.start_timestamp ? Math.round((c.end_timestamp - c.start_timestamp) / 1000) + 's' : 'n/a'}`);
    console.log(`  Disconnect: ${c.disconnection_reason || 'n/a'}`);
    console.log('');
  }
}

main().catch(console.error);
