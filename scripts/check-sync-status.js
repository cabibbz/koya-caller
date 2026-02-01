/**
 * Check auto-sync status and recent system logs
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

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const businessId = '5a0a09c7-2050-485a-b803-3fd6d556c534'; // Netapp

async function main() {
  console.log('=== CHECKING AUTO-SYNC STATUS ===\n');

  // Check required env vars
  console.log('Required Environment Variables:');
  console.log('  RETELL_API_KEY:', process.env.RETELL_API_KEY ? '✓ Set' : '✗ MISSING');
  console.log('  ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✓ Set' : '✗ MISSING');
  console.log('  INNGEST_EVENT_KEY:', process.env.INNGEST_EVENT_KEY ? '✓ Set (using Inngest)' : '✗ Not set (using fallback)');

  // Check AI config for Netapp
  const { data: aiConfig } = await supabase
    .from('ai_config')
    .select('retell_agent_id, system_prompt_version, system_prompt_generated_at, retell_synced_at')
    .eq('business_id', businessId)
    .single();

  console.log('\n--- Netapp AI Config ---');
  console.log('  Retell Agent ID:', aiConfig?.retell_agent_id || 'NOT SET');
  console.log('  Prompt Version:', aiConfig?.system_prompt_version || 0);
  console.log('  Last Generated:', aiConfig?.system_prompt_generated_at || 'Never');
  console.log('  Last Retell Sync:', aiConfig?.retell_synced_at || 'Never');

  // Check recent system logs for this business
  const { data: logs } = await supabase
    .from('system_logs')
    .select('event_type, message, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n--- Recent System Logs ---');
  if (logs && logs.length > 0) {
    logs.forEach(log => {
      console.log(`  [${log.created_at}] ${log.event_type}: ${log.message}`);
    });
  } else {
    console.log('  No logs found');
  }

  // Check regeneration queue
  const { data: queue } = await supabase
    .from('prompt_regeneration_queue')
    .select('status, triggered_by, created_at, processed_at, error_message')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n--- Recent Queue Items ---');
  if (queue && queue.length > 0) {
    queue.forEach(item => {
      console.log(`  [${item.created_at}] ${item.status} - ${item.triggered_by}`);
      if (item.error_message) console.log(`    Error: ${item.error_message}`);
    });
  } else {
    console.log('  No queue items found');
  }

  console.log('\n=== SUMMARY ===');
  if (!aiConfig?.retell_agent_id) {
    console.log('❌ No Retell agent linked to Netapp! Auto-sync won\'t work.');
  } else if (!process.env.ANTHROPIC_API_KEY) {
    console.log('❌ ANTHROPIC_API_KEY missing! Claude can\'t generate prompts.');
  } else if (!process.env.RETELL_API_KEY) {
    console.log('❌ RETELL_API_KEY missing! Can\'t update Retell agent.');
  } else if (!aiConfig?.retell_synced_at) {
    console.log('⚠️  Retell never synced. Try saving in the dashboard or run sync manually.');
  } else {
    console.log('✓ Auto-sync should be working. Check if dev server is running.');
  }
}

main();
