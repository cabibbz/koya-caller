/**
 * Check call records in database
 * Run with: node scripts/check-db-calls.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkDbCalls() {
  console.log('\n========================================');
  console.log('DATABASE CALL RECORDS');
  console.log('========================================\n');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('❌ Supabase credentials missing');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check calls table
  const { data: calls, error } = await supabase
    .from('calls')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(10);

  if (error) {
    console.log('❌ Error querying calls:', error.message);
    return;
  }

  if (!calls || calls.length === 0) {
    console.log('❌ NO CALLS FOUND IN DATABASE');
    console.log('   This means the webhook is either:');
    console.log('   - Not being called by Twilio');
    console.log('   - Failing before creating a call record');
    console.log('   - Returning fallback TwiML without reaching Retell handler');
  } else {
    console.log(`Found ${calls.length} call record(s):\n`);

    calls.forEach((call, i) => {
      console.log(`Call ${i + 1}:`);
      console.log(`   ID: ${call.id.substring(0, 8)}...`);
      console.log(`   From: ${call.from_number}`);
      console.log(`   To: ${call.to_number}`);
      console.log(`   Started: ${call.started_at}`);
      console.log(`   Ended: ${call.ended_at || 'Not ended'}`);
      console.log(`   Duration: ${call.duration_seconds || 0}s`);
      console.log(`   Outcome: ${call.outcome || 'No outcome'}`);
      console.log(`   Retell Call ID: ${call.retell_call_id || 'NOT SET'}`);
      console.log(`   Summary: ${call.summary || 'No summary'}`);
      console.log('');
    });
  }

  // Check system logs for errors
  console.log('\n========================================');
  console.log('SYSTEM LOGS (Errors)');
  console.log('========================================\n');

  const { data: logs, error: logsError } = await supabase
    .from('system_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (logsError) {
    if (logsError.message.includes('does not exist')) {
      console.log('   system_logs table does not exist (this is OK)');
    } else {
      console.log('❌ Error querying system_logs:', logsError.message);
    }
  } else if (!logs || logs.length === 0) {
    console.log('   No system logs found');
  } else {
    logs.forEach(log => {
      console.log(`[${log.level}] ${log.created_at}`);
      console.log(`   ${log.message}`);
      if (log.metadata) {
        console.log(`   Metadata: ${JSON.stringify(log.metadata)}`);
      }
      console.log('');
    });
  }

  console.log('\n');
}

checkDbCalls().catch(console.error);
