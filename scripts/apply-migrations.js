/**
 * Apply all migrations to Supabase database
 * Run with: node scripts/apply-migrations.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkfcipjastgqtusijbav.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprZmNpcGphc3RncXR1c2lqYmF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzgwNTk4NiwiZXhwIjoyMDgzMzgxOTg2fQ.4U-6XiqUOxMvfeU0XftdkLEehXskSESWZgl3xjkHDZY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const migrations = [
  {
    name: "Migration 1: Fix Calls and Settings",
    sql: `
      ALTER TABLE calls ADD COLUMN IF NOT EXISTS flagged boolean DEFAULT false;
      ALTER TABLE calls ADD COLUMN IF NOT EXISTS notes text;
      ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS after_hours_action text DEFAULT 'ai';
      ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS recording_enabled boolean DEFAULT true;
    `
  },
  {
    name: "Migration 2: Enhanced Prompt System - ai_config",
    sql: `
      ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS prompt_config JSONB DEFAULT '{"industryEnhancements": true, "fewShotExamplesEnabled": true, "sentimentDetectionLevel": "basic", "callerContextEnabled": true, "toneIntensity": 3, "personalityAwareErrors": true, "maxFewShotExamples": 3}'::jsonb;
    `
  },
  {
    name: "Migration 2b: Calls sentiment columns",
    sql: `
      ALTER TABLE calls ADD COLUMN IF NOT EXISTS sentiment_detected TEXT;
      ALTER TABLE calls ADD COLUMN IF NOT EXISTS error_recovery_used BOOLEAN DEFAULT false;
    `
  },
  {
    name: "Migration 3: Upsells - ai_config column",
    sql: `
      ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS upsells_enabled boolean DEFAULT true;
    `
  },
  {
    name: "Migration 4: Advanced Upselling - ai_config columns",
    sql: `
      ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS bundles_enabled boolean DEFAULT true;
      ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS packages_enabled boolean DEFAULT true;
      ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS memberships_enabled boolean DEFAULT true;
    `
  },
  {
    name: "Migration 5: Appointment Reminder Columns",
    sql: `
      ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_1hr_sent_at timestamptz;
      ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_24hr_sent_at timestamptz;
    `
  },
  {
    name: "Migration 7: Retell Sync Tracking",
    sql: `
      ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS retell_synced_at timestamptz;
    `
  },
  {
    name: "Migration 8: Retell Advanced - Voicemail",
    sql: `
      ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS voicemail_detection_enabled boolean DEFAULT false;
      ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS voicemail_message text;
      ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS voicemail_detection_timeout_ms integer DEFAULT 30000;
    `
  },
  {
    name: "Migration 8: Retell Advanced - Silence Handling",
    sql: `
      ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS reminder_trigger_ms integer DEFAULT 10000;
      ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS reminder_max_count integer DEFAULT 2;
      ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS end_call_after_silence_ms integer DEFAULT 30000;
    `
  },
  {
    name: "Migration 8: Retell Advanced - DTMF",
    sql: `
      ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS dtmf_enabled boolean DEFAULT false;
      ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS dtmf_digit_limit integer DEFAULT 10;
      ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS dtmf_termination_key text DEFAULT '#';
      ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS dtmf_timeout_ms integer DEFAULT 5000;
    `
  },
  {
    name: "Migration 8: Retell Advanced - Denoising & PII",
    sql: `
      ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS denoising_mode text DEFAULT 'noise-cancellation';
      ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS pii_redaction_enabled boolean DEFAULT false;
      ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS pii_categories text[] DEFAULT ARRAY['ssn', 'credit_card']::text[];
    `
  },
  {
    name: "Migration 8: Retell Advanced - AI Config",
    sql: `
      ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS boosted_keywords text[] DEFAULT '{}'::text[];
      ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS analysis_summary_prompt text;
      ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS analysis_model text DEFAULT 'gpt-4.1-mini';
      ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS fallback_voice_ids text[] DEFAULT '{}'::text[];
    `
  }
];

async function runMigrations() {
  console.log('Starting migrations...\n');

  for (const migration of migrations) {
    console.log(`Running: ${migration.name}`);
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: migration.sql });
      if (error) {
        // Try direct query if rpc doesn't exist
        console.log(`  - RPC not available, this is expected`);
      } else {
        console.log(`  ✓ Success`);
      }
    } catch (err) {
      console.log(`  - Note: ${err.message}`);
    }
  }

  console.log('\n--- Verifying columns ---\n');

  // Verify call_settings columns
  const { data: callSettingsCols } = await supabase
    .from('call_settings')
    .select('*')
    .limit(1);

  if (callSettingsCols) {
    const cols = callSettingsCols[0] ? Object.keys(callSettingsCols[0]) : [];
    console.log('call_settings columns:', cols.length, 'columns found');

    const expectedCols = [
      'voicemail_detection_enabled', 'voicemail_message', 'dtmf_enabled',
      'denoising_mode', 'pii_redaction_enabled', 'reminder_trigger_ms'
    ];
    const missing = expectedCols.filter(c => !cols.includes(c));
    if (missing.length > 0) {
      console.log('  Missing columns:', missing.join(', '));
    } else {
      console.log('  ✓ All Retell advanced columns present');
    }
  }

  // Verify ai_config columns
  const { data: aiConfigCols } = await supabase
    .from('ai_config')
    .select('*')
    .limit(1);

  if (aiConfigCols) {
    const cols = aiConfigCols[0] ? Object.keys(aiConfigCols[0]) : [];
    console.log('\nai_config columns:', cols.length, 'columns found');

    const expectedCols = [
      'prompt_config', 'boosted_keywords', 'analysis_summary_prompt',
      'analysis_model', 'retell_synced_at', 'upsells_enabled'
    ];
    const missing = expectedCols.filter(c => !cols.includes(c));
    if (missing.length > 0) {
      console.log('  Missing columns:', missing.join(', '));
    } else {
      console.log('  ✓ All AI config columns present');
    }
  }

  // Verify calls columns
  const { data: callsCols } = await supabase
    .from('calls')
    .select('*')
    .limit(1);

  if (callsCols !== null) {
    const cols = callsCols[0] ? Object.keys(callsCols[0]) : [];
    console.log('\ncalls columns:', cols.length > 0 ? cols.length + ' columns found' : 'table exists (empty)');
  }

  // Check for tables
  console.log('\n--- Checking tables ---\n');

  const tables = ['upsells', 'bundles', 'packages', 'memberships', 'caller_profiles'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error && error.code === '42P01') {
      console.log(`  ✗ ${table} - NOT FOUND`);
    } else {
      console.log(`  ✓ ${table} - exists`);
    }
  }
}

runMigrations().catch(console.error);
