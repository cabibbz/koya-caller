/**
 * Script to update Retell agent webhook URLs to current app URL
 * Run after changing your ngrok URL or domain
 *
 * Usage: node scripts/update-agent-webhook-url.js
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
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;

if (!RETELL_API_KEY) {
  console.error('RETELL_API_KEY is required');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Supabase credentials are required');
  process.exit(1);
}

if (!APP_URL) {
  console.error('NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL is required');
  process.exit(1);
}

const retellClient = new Retell({ apiKey: RETELL_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  const webhookUrl = `${APP_URL.replace(/\/$/, '')}/api/retell/webhook`;
  const functionUrl = `${APP_URL.replace(/\/$/, '')}/api/retell/function`;

  console.log('='.repeat(60));
  console.log('Retell Agent Webhook URL Updater');
  console.log('='.repeat(60));
  console.log(`\nNew webhook URL: ${webhookUrl}`);
  console.log(`New function URL: ${functionUrl}\n`);

  // Get all agent IDs from database
  const { data: configs, error: configError } = await supabase
    .from('ai_config')
    .select('business_id, retell_agent_id, retell_agent_id_spanish')
    .not('retell_agent_id', 'is', null);

  if (configError) {
    console.error('Error fetching agent configs:', configError);
    process.exit(1);
  }

  if (!configs || configs.length === 0) {
    console.log('No agents found to update');
    return;
  }

  // Collect all unique agent IDs
  const agentIds = new Set();
  for (const config of configs) {
    if (config.retell_agent_id) agentIds.add(config.retell_agent_id);
    if (config.retell_agent_id_spanish) agentIds.add(config.retell_agent_id_spanish);
  }

  console.log(`Found ${agentIds.size} agents to update\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const agentId of agentIds) {
    console.log(`Updating agent ${agentId}...`);

    try {
      // First, get current agent to see its LLM config
      const agent = await retellClient.agent.retrieve(agentId);

      // Update webhook URL
      await retellClient.agent.update(agentId, {
        webhook_url: webhookUrl,
      });

      // If agent has an LLM, update the function URLs in the LLM config
      if (agent.response_engine?.type === 'retell-llm' && agent.response_engine?.llm_id) {
        const llmId = agent.response_engine.llm_id;
        console.log(`  - Also updating LLM ${llmId} function URLs...`);

        try {
          const llm = await retellClient.llm.retrieve(llmId);

          // Update any custom tool URLs
          if (llm.general_tools && llm.general_tools.length > 0) {
            const updatedTools = llm.general_tools.map(tool => {
              if (tool.type === 'custom' && tool.url) {
                return { ...tool, url: functionUrl };
              }
              return tool;
            });

            await retellClient.llm.update(llmId, {
              general_tools: updatedTools,
            });
            console.log(`    ✓ LLM tools updated`);
          }
        } catch (llmErr) {
          console.log(`    - Could not update LLM: ${llmErr.message}`);
        }
      }

      console.log(`  ✓ Agent webhook updated successfully\n`);
      successCount++;
    } catch (err) {
      console.error(`  ✗ Failed to update agent: ${err.message || err}\n`);
      errorCount++;
    }
  }

  console.log('='.repeat(60));
  console.log('Update complete:');
  console.log(`  ✓ Success: ${successCount}`);
  console.log(`  ✗ Failed: ${errorCount}`);
  console.log('='.repeat(60));

  if (successCount > 0) {
    console.log('\n✅ Your agents are now configured to use:');
    console.log(`   Webhook: ${webhookUrl}`);
    console.log(`   Functions: ${functionUrl}`);
    console.log('\nTry making a call again!');
  }
}

main().catch(console.error);
