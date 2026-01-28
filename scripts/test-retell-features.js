/**
 * Test Retell Integration Features
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jkfcipjastgqtusijbav.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprZmNpcGphc3RncXR1c2lqYmF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzgwNTk4NiwiZXhwIjoyMDgzMzgxOTg2fQ.4U-6XiqUOxMvfeU0XftdkLEehXskSESWZgl3xjkHDZY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testRetellFeatures() {
  console.log('\n' + '='.repeat(60));
  console.log('RETELL ADVANCED FEATURES TEST');
  console.log('='.repeat(60) + '\n');

  // Get a business with a Retell agent
  const { data: aiConfigs, error } = await supabase
    .from('ai_config')
    .select('business_id, retell_agent_id, voice_id, ai_name, boosted_keywords, analysis_model')
    .not('retell_agent_id', 'is', null)
    .limit(5);

  if (error) {
    console.log('❌ Error fetching ai_config:', error.message);
    return;
  }

  if (!aiConfigs || aiConfigs.length === 0) {
    console.log('⚠️  No businesses with Retell agents configured');
    console.log('   To test: Complete onboarding for a business first');
    return;
  }

  console.log(`Found ${aiConfigs.length} business(es) with Retell agents:\n`);

  for (const config of aiConfigs) {
    console.log(`Business: ${config.business_id.slice(0, 8)}...`);
    console.log(`  Retell Agent: ${config.retell_agent_id}`);
    console.log(`  Voice ID: ${config.voice_id || 'Not set'}`);
    console.log(`  AI Name: ${config.ai_name || 'Not set'}`);
    console.log(`  Boosted Keywords: ${config.boosted_keywords?.join(', ') || 'None'}`);
    console.log(`  Analysis Model: ${config.analysis_model || 'Default'}`);

    // Get call settings
    const { data: callSettings } = await supabase
      .from('call_settings')
      .select('*')
      .eq('business_id', config.business_id)
      .single();

    if (callSettings) {
      console.log('\n  Call Settings:');
      console.log(`    Recording: ${callSettings.recording_enabled ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`    Max Duration: ${callSettings.max_call_duration_seconds}s`);
      console.log(`    Voicemail Detection: ${callSettings.voicemail_detection_enabled ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`    DTMF Input: ${callSettings.dtmf_enabled ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`    Denoising: ${callSettings.denoising_mode || 'Default'}`);
      console.log(`    PII Redaction: ${callSettings.pii_redaction_enabled ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`    Silence Reminder: ${callSettings.reminder_trigger_ms}ms after ${callSettings.reminder_max_count} reminders`);
    } else {
      console.log('\n  ⚠️  No call_settings record found');
    }

    console.log('\n' + '-'.repeat(40) + '\n');
  }

  // Test that we can update settings
  console.log('Testing settings update capability...\n');

  if (aiConfigs[0]) {
    const testBusinessId = aiConfigs[0].business_id;

    // Try to update call_settings
    const { error: updateError } = await supabase
      .from('call_settings')
      .upsert({
        business_id: testBusinessId,
        voicemail_detection_enabled: false,
        dtmf_enabled: false,
        denoising_mode: 'noise-cancellation',
        pii_redaction_enabled: false,
        reminder_trigger_ms: 10000,
        reminder_max_count: 2,
        end_call_after_silence_ms: 30000,
        updated_at: new Date().toISOString()
      }, { onConflict: 'business_id' });

    if (updateError) {
      console.log('❌ Settings update failed:', updateError.message);
    } else {
      console.log('✅ Settings update successful');
    }

    // Try to update ai_config
    const { error: aiUpdateError } = await supabase
      .from('ai_config')
      .update({
        boosted_keywords: ['Koya', 'appointment', 'booking'],
        analysis_model: 'gpt-4.1-mini',
        updated_at: new Date().toISOString()
      })
      .eq('business_id', testBusinessId);

    if (aiUpdateError) {
      console.log('❌ AI config update failed:', aiUpdateError.message);
    } else {
      console.log('✅ AI config update successful');
    }
  }
}

testRetellFeatures().catch(console.error);
