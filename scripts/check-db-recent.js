/**
 * Check recent calls in database
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: calls, error } = await supabase
    .from('calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log(`Recent calls in database (${calls.length}):\n`);

  for (const c of calls) {
    console.log(`Call ID: ${c.id}`);
    console.log(`  From: ${c.from_number}`);
    console.log(`  To: ${c.to_number}`);
    console.log(`  Retell Call ID: ${c.retell_call_id || 'NOT SET'}`);
    console.log(`  Outcome: ${c.outcome || 'n/a'}`);
    console.log(`  Started: ${c.started_at}`);
    console.log(`  Summary: ${c.summary || 'n/a'}`);
    console.log('');
  }
}

main().catch(console.error);
