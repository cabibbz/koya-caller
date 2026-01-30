/**
 * Script to update existing Retell agents with advanced feature settings
 * Syncs voicemail detection, silence handling, DTMF, denoising, boosted keywords,
 * summary prompts, PII redaction, and fallback voices from database to Retell agents.
 *
 * Run with: node scripts/update-agents-advanced-features.js
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

/**
 * Build the Retell agent update config from database settings
 */
function buildAgentConfig(aiConfig, callSettings) {
  const config = {};

  // Voicemail Detection
  if (callSettings?.voicemail_detection_enabled !== undefined) {
    config.enable_voicemail_detection = callSettings.voicemail_detection_enabled;
    if (callSettings.voicemail_detection_enabled) {
      if (callSettings.voicemail_message) {
        config.voicemail_message = callSettings.voicemail_message;
      }
      if (callSettings.voicemail_detection_timeout_ms) {
        config.voicemail_detection_timeout_ms = callSettings.voicemail_detection_timeout_ms;
      }
    }
  }

  // Silence Handling
  if (callSettings?.reminder_trigger_ms) {
    config.reminder_trigger_ms = callSettings.reminder_trigger_ms;
  }
  if (callSettings?.reminder_max_count !== undefined) {
    config.reminder_max_count = callSettings.reminder_max_count;
  }
  if (callSettings?.end_call_after_silence_ms) {
    config.end_call_after_silence_ms = callSettings.end_call_after_silence_ms;
  }

  // Boosted Keywords
  if (aiConfig?.boosted_keywords?.length > 0) {
    config.boosted_keywords = aiConfig.boosted_keywords;
  }

  // DTMF (Touch-Tone)
  if (callSettings?.dtmf_enabled !== undefined) {
    config.allow_user_dtmf = callSettings.dtmf_enabled;
    if (callSettings.dtmf_enabled) {
      config.user_dtmf_options = {
        digit_limit: callSettings.dtmf_digit_limit || 10,
        termination_key: callSettings.dtmf_termination_key || '#',
        timeout_ms: callSettings.dtmf_timeout_ms || 5000,
      };
    }
  }

  // Denoising Mode
  if (callSettings?.denoising_mode) {
    config.ambient_sound_volume = 0;
    // Note: denoising_mode itself may not be a direct Retell parameter
    // but ambient_sound_volume=0 enables noise cancellation
  }

  // Custom Summary Prompt
  if (aiConfig?.analysis_summary_prompt) {
    config.post_call_analysis_prompt = aiConfig.analysis_summary_prompt;
  }
  if (aiConfig?.analysis_model) {
    config.post_call_analysis_model = aiConfig.analysis_model;
  }

  // PII Redaction
  if (callSettings?.pii_redaction_enabled) {
    config.pii_config = {
      mode: 'post_call',
      categories: callSettings.pii_categories || ['ssn', 'credit_card'],
    };
  }

  // Fallback Voices
  if (aiConfig?.fallback_voice_ids?.length > 0) {
    config.fallback_voice_ids = aiConfig.fallback_voice_ids;
  }

  return config;
}

async function main() {
  console.log('Fetching all agents with their settings from database...\n');

  // Get all agent IDs with their related settings
  const { data: configs, error: configError } = await supabase
    .from('ai_config')
    .select('business_id, retell_agent_id, boosted_keywords, analysis_summary_prompt, analysis_model, fallback_voice_ids')
    .not('retell_agent_id', 'is', null);

  if (configError) {
    console.error('Error fetching agent configs:', configError);
    process.exit(1);
  }

  if (!configs || configs.length === 0) {
    console.log('No agents found to update');
    return;
  }

  console.log(`Found ${configs.length} agents to update\n`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const config of configs) {
    const agentId = config.retell_agent_id;
    const businessId = config.business_id;

    console.log(`Processing agent ${agentId} (business: ${businessId})...`);

    // Fetch call settings for this business
    const { data: callSettings, error: callError } = await supabase
      .from('call_settings')
      .select('*')
      .eq('business_id', businessId)
      .single();

    if (callError && callError.code !== 'PGRST116') {
      console.log(`  - No call settings found, using defaults`);
    }

    // Build the update config
    const updateConfig = buildAgentConfig(config, callSettings);

    // Skip if nothing to update
    if (Object.keys(updateConfig).length === 0) {
      console.log(`  - No advanced settings to update, skipping`);
      skippedCount++;
      continue;
    }

    console.log(`  - Settings to apply:`, JSON.stringify(updateConfig, null, 2).replace(/\n/g, '\n    '));

    try {
      await retellClient.agent.update(agentId, updateConfig);
      console.log(`  ✓ Agent updated successfully\n`);
      successCount++;
    } catch (err) {
      console.error(`  ✗ Failed to update agent:`, err.message || err, '\n');
      errorCount++;
    }
  }

  console.log(`\nUpdate complete:`);
  console.log(`  ✓ Success: ${successCount}`);
  console.log(`  - Skipped: ${skippedCount}`);
  console.log(`  ✗ Failed: ${errorCount}`);
}

main().catch(console.error);
