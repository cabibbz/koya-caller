/**
 * Apply migrations directly via PostgreSQL connection
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase connection - using the REST API to apply individual column changes
const SUPABASE_URL = 'https://jkfcipjastgqtusijbav.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprZmNpcGphc3RncXR1c2lqYmF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzgwNTk4NiwiZXhwIjoyMDgzMzgxOTg2fQ.4U-6XiqUOxMvfeU0XftdkLEehXskSESWZgl3xjkHDZY';

async function checkCurrentState() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('='.repeat(60));
  console.log('CURRENT DATABASE STATE');
  console.log('='.repeat(60));

  // Check call_settings
  console.log('\n📋 call_settings table:');
  const { data: cs, error: csErr } = await supabase.from('call_settings').select('*').limit(1);
  if (csErr) {
    console.log('  Error:', csErr.message);
  } else if (cs && cs[0]) {
    const cols = Object.keys(cs[0]);
    console.log('  Existing columns (' + cols.length + '):', cols.join(', '));

    const needed = [
      'voicemail_detection_enabled', 'voicemail_message', 'voicemail_detection_timeout_ms',
      'reminder_trigger_ms', 'reminder_max_count', 'end_call_after_silence_ms',
      'dtmf_enabled', 'dtmf_digit_limit', 'dtmf_termination_key', 'dtmf_timeout_ms',
      'denoising_mode', 'pii_redaction_enabled', 'pii_categories'
    ];
    const missing = needed.filter(c => !cols.includes(c));
    if (missing.length > 0) {
      console.log('\n  ❌ MISSING COLUMNS:', missing.join(', '));
    } else {
      console.log('\n  ✅ All Retell columns present!');
    }
  } else {
    console.log('  No call_settings records found (table may be empty)');
  }

  // Check ai_config
  console.log('\n📋 ai_config table:');
  const { data: ac, error: acErr } = await supabase.from('ai_config').select('*').limit(1);
  if (acErr) {
    console.log('  Error:', acErr.message);
  } else if (ac && ac[0]) {
    const cols = Object.keys(ac[0]);
    console.log('  Existing columns (' + cols.length + '):', cols.join(', '));

    const needed = [
      'prompt_config', 'boosted_keywords', 'analysis_summary_prompt',
      'analysis_model', 'fallback_voice_ids', 'retell_synced_at',
      'upsells_enabled', 'bundles_enabled', 'packages_enabled', 'memberships_enabled'
    ];
    const missing = needed.filter(c => !cols.includes(c));
    if (missing.length > 0) {
      console.log('\n  ❌ MISSING COLUMNS:', missing.join(', '));
    } else {
      console.log('\n  ✅ All AI config columns present!');
    }
  }

  // Check appointments
  console.log('\n📋 appointments table:');
  const { data: appt, error: apptErr } = await supabase.from('appointments').select('*').limit(1);
  if (apptErr) {
    console.log('  Error:', apptErr.message);
  } else if (appt && appt[0]) {
    const cols = Object.keys(appt[0]);
    const needed = ['reminder_1hr_sent_at', 'reminder_24hr_sent_at'];
    const missing = needed.filter(c => !cols.includes(c));
    if (missing.length > 0) {
      console.log('  ❌ MISSING:', missing.join(', '));
    } else {
      console.log('  ✅ Reminder columns present');
    }
  }

  // Check calls
  console.log('\n📋 calls table:');
  const { data: calls, error: callsErr } = await supabase.from('calls').select('*').limit(1);
  if (callsErr) {
    console.log('  Error:', callsErr.message);
  } else if (calls && calls[0]) {
    const cols = Object.keys(calls[0]);
    const needed = ['flagged', 'notes', 'sentiment_detected', 'error_recovery_used'];
    const missing = needed.filter(c => !cols.includes(c));
    if (missing.length > 0) {
      console.log('  ❌ MISSING:', missing.join(', '));
    } else {
      console.log('  ✅ All call tracking columns present');
    }
  }

  // Check tables exist
  console.log('\n📋 Required tables:');
  const tables = ['upsells', 'bundles', 'packages', 'memberships', 'caller_profiles', 'bundle_services'];
  for (const t of tables) {
    const { error } = await supabase.from(t).select('id').limit(1);
    if (error && error.code === '42P01') {
      console.log(`  ❌ ${t} - DOES NOT EXIST`);
    } else if (error) {
      console.log(`  ⚠️ ${t} - ${error.message}`);
    } else {
      console.log(`  ✅ ${t}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SQL TO APPLY (copy to Supabase SQL Editor):');
  console.log('='.repeat(60));
  console.log(`
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/jkfcipjastgqtusijbav/sql/new

-- RETELL ADVANCED FEATURES (call_settings)
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS voicemail_detection_enabled boolean DEFAULT false;
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS voicemail_message text;
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS voicemail_detection_timeout_ms integer DEFAULT 30000;
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS reminder_trigger_ms integer DEFAULT 10000;
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS reminder_max_count integer DEFAULT 2;
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS end_call_after_silence_ms integer DEFAULT 30000;
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS dtmf_enabled boolean DEFAULT false;
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS dtmf_digit_limit integer DEFAULT 10;
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS dtmf_termination_key text DEFAULT '#';
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS dtmf_timeout_ms integer DEFAULT 5000;
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS denoising_mode text DEFAULT 'noise-cancellation';
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS pii_redaction_enabled boolean DEFAULT false;
ALTER TABLE call_settings ADD COLUMN IF NOT EXISTS pii_categories text[] DEFAULT ARRAY['ssn', 'credit_card']::text[];

-- AI CONFIG ADDITIONS
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS boosted_keywords text[] DEFAULT '{}'::text[];
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS analysis_summary_prompt text;
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS analysis_model text DEFAULT 'gpt-4.1-mini';
ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS fallback_voice_ids text[] DEFAULT '{}'::text[];

SELECT 'Migrations applied!' as status;
`);
}

checkCurrentState().catch(console.error);
