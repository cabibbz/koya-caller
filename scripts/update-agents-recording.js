/**
 * Script to update existing Retell agents with recording and post-call analysis settings
 *
 * Run with: node scripts/update-agents-recording.js
 */

const fs = require('fs');
const path = require('path');

// Manually load .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local file not found');
    process.exit(1);
  }

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

const Retell = require('retell-sdk').default;
const { createClient } = require('@supabase/supabase-js');

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Production fallback URL - consistent with lib/config/index.ts
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://koyacaller.com';

if (!RETELL_API_KEY) {
  console.error('RETELL_API_KEY is required');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Supabase credentials are required');
  process.exit(1);
}

const retellClient = new Retell({ apiKey: RETELL_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const POST_CALL_ANALYSIS_CONFIG = [
  {
    type: 'call_summary',
    name: 'call_summary',
    description: 'A brief summary of what the caller wanted and the outcome of the call',
  },
  {
    type: 'custom',
    name: 'customer_name',
    description: 'The name of the caller if provided',
  },
  {
    type: 'custom',
    name: 'customer_phone',
    description: 'The phone number of the caller if provided',
  },
  {
    type: 'custom',
    name: 'customer_email',
    description: 'The email address of the caller if provided',
  },
  {
    type: 'custom',
    name: 'service_name',
    description: 'The service the caller inquired about or booked',
  },
  {
    type: 'custom',
    name: 'appointment_date',
    description: 'The date and time of any appointment booked (ISO format)',
  },
  {
    type: 'custom',
    name: 'appointment_booked',
    description: 'Whether an appointment was booked (true/false)',
  },
];

async function main() {
  console.log('Fetching all agents from database...');

  // Get all agent IDs from ai_config table
  const { data: configs, error } = await supabase
    .from('ai_config')
    .select('business_id, retell_agent_id')
    .not('retell_agent_id', 'is', null);

  if (error) {
    console.error('Error fetching agent configs:', error);
    process.exit(1);
  }

  if (!configs || configs.length === 0) {
    console.log('No agents found to update');
    return;
  }

  console.log(`Found ${configs.length} agents to update\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const config of configs) {
    const agentId = config.retell_agent_id;
    console.log(`Updating agent ${agentId}...`);

    try {
      await retellClient.agent.update(agentId, {
        enable_recording: true,
        webhook_url: `${SITE_URL}/api/retell/webhook`,
        post_call_analysis_data: POST_CALL_ANALYSIS_CONFIG,
      });

      console.log(`  ✓ Agent ${agentId} updated successfully`);
      successCount++;
    } catch (err) {
      console.error(`  ✗ Failed to update agent ${agentId}:`, err.message || err);
      errorCount++;
    }
  }

  console.log(`\nUpdate complete:`);
  console.log(`  ✓ Success: ${successCount}`);
  console.log(`  ✗ Failed: ${errorCount}`);
}

main().catch(console.error);
