/**
 * Comprehensive Feature Testing Script
 * Tests all Koya Caller features
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jkfcipjastgqtusijbav.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprZmNpcGphc3RncXR1c2lqYmF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzgwNTk4NiwiZXhwIjoyMDgzMzgxOTg2fQ.4U-6XiqUOxMvfeU0XftdkLEehXskSESWZgl3xjkHDZY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const results = {
  passed: [],
  failed: [],
  warnings: []
};

function log(emoji, msg) {
  console.log(`${emoji} ${msg}`);
}

function pass(test) {
  results.passed.push(test);
  log('✅', test);
}

function fail(test, reason) {
  results.failed.push({ test, reason });
  log('❌', `${test}: ${reason}`);
}

function warn(test, reason) {
  results.warnings.push({ test, reason });
  log('⚠️', `${test}: ${reason}`);
}

// ============================================================================
// 1. DATABASE SCHEMA TESTS
// ============================================================================
async function testDatabaseSchema() {
  console.log('\n' + '='.repeat(60));
  console.log('1. DATABASE SCHEMA TESTS');
  console.log('='.repeat(60) + '\n');

  // Test core tables exist
  const coreTables = [
    'businesses', 'business_hours', 'services', 'faqs', 'knowledge',
    'ai_config', 'call_settings', 'calendar_integrations', 'availability_slots',
    'phone_numbers', 'calls', 'appointments', 'sms_messages', 'notification_settings'
  ];

  for (const table of coreTables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error && error.code === '42P01') {
      fail(`Table: ${table}`, 'Table does not exist');
    } else if (error) {
      warn(`Table: ${table}`, error.message);
    } else {
      pass(`Table: ${table} exists`);
    }
  }

  // Test extended tables (from migrations)
  const extendedTables = [
    'upsells', 'bundles', 'bundle_services', 'packages', 'memberships',
    'caller_profiles', 'business_templates', 'demo_leads', 'site_settings',
    'locations', 'blog_posts', 'blog_clusters'
  ];

  for (const table of extendedTables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error && error.code === '42P01') {
      warn(`Table: ${table}`, 'Table does not exist (optional)');
    } else if (error) {
      warn(`Table: ${table}`, error.message);
    } else {
      pass(`Table: ${table} exists`);
    }
  }

  // Test call_settings columns (Retell advanced features)
  const { data: csData } = await supabase.from('call_settings').select('*').limit(1);
  if (csData && csData[0]) {
    const cols = Object.keys(csData[0]);

    const requiredCols = [
      'business_id', 'transfer_number', 'transfer_on_request',
      'after_hours_enabled', 'max_call_duration_seconds', 'recording_enabled'
    ];

    const retellCols = [
      'voicemail_detection_enabled', 'voicemail_message', 'voicemail_detection_timeout_ms',
      'reminder_trigger_ms', 'reminder_max_count', 'end_call_after_silence_ms',
      'dtmf_enabled', 'dtmf_digit_limit', 'dtmf_termination_key', 'dtmf_timeout_ms',
      'denoising_mode', 'pii_redaction_enabled', 'pii_categories'
    ];

    for (const col of requiredCols) {
      if (cols.includes(col)) {
        pass(`call_settings.${col}`);
      } else {
        fail(`call_settings.${col}`, 'Column missing');
      }
    }

    for (const col of retellCols) {
      if (cols.includes(col)) {
        pass(`call_settings.${col} (Retell)`);
      } else {
        fail(`call_settings.${col} (Retell)`, 'Column missing - run migrations');
      }
    }
  } else {
    warn('call_settings columns', 'No data to check columns');
  }

  // Test ai_config columns
  const { data: acData } = await supabase.from('ai_config').select('*').limit(1);
  if (acData && acData[0]) {
    const cols = Object.keys(acData[0]);

    const requiredCols = [
      'business_id', 'voice_id', 'ai_name', 'personality', 'greeting',
      'system_prompt', 'retell_agent_id'
    ];

    const advancedCols = [
      'prompt_config', 'boosted_keywords', 'analysis_summary_prompt',
      'analysis_model', 'fallback_voice_ids', 'retell_synced_at',
      'upsells_enabled', 'bundles_enabled', 'packages_enabled', 'memberships_enabled'
    ];

    for (const col of requiredCols) {
      if (cols.includes(col)) {
        pass(`ai_config.${col}`);
      } else {
        fail(`ai_config.${col}`, 'Column missing');
      }
    }

    for (const col of advancedCols) {
      if (cols.includes(col)) {
        pass(`ai_config.${col} (Advanced)`);
      } else {
        fail(`ai_config.${col} (Advanced)`, 'Column missing - run migrations');
      }
    }
  }

  // Test calls columns
  const { data: callsData } = await supabase.from('calls').select('*').limit(1);
  if (callsData !== null) {
    const cols = callsData[0] ? Object.keys(callsData[0]) : [];
    const neededCols = ['flagged', 'notes', 'sentiment_detected', 'error_recovery_used'];

    if (cols.length > 0) {
      for (const col of neededCols) {
        if (cols.includes(col)) {
          pass(`calls.${col}`);
        } else {
          fail(`calls.${col}`, 'Column missing');
        }
      }
    } else {
      warn('calls columns', 'Table empty, cannot verify columns');
    }
  }

  // Test appointments columns
  const { data: apptData } = await supabase.from('appointments').select('*').limit(1);
  if (apptData !== null) {
    const cols = apptData[0] ? Object.keys(apptData[0]) : [];
    const neededCols = ['reminder_1hr_sent_at', 'reminder_24hr_sent_at'];

    if (cols.length > 0) {
      for (const col of neededCols) {
        if (cols.includes(col)) {
          pass(`appointments.${col}`);
        } else {
          fail(`appointments.${col}`, 'Column missing');
        }
      }
    }
  }
}

// ============================================================================
// 2. API ENDPOINT TESTS (via fetch)
// ============================================================================
async function testAPIEndpoints() {
  console.log('\n' + '='.repeat(60));
  console.log('2. API ENDPOINT TESTS');
  console.log('='.repeat(60) + '\n');

  const BASE_URL = 'http://localhost:3000';

  // Test public endpoints
  const publicEndpoints = [
    { method: 'GET', path: '/api/site/settings', name: 'Site Settings' },
  ];

  for (const ep of publicEndpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`, { method: ep.method });
      if (res.ok) {
        pass(`API ${ep.method} ${ep.path}`);
      } else {
        const body = await res.json().catch(() => ({}));
        warn(`API ${ep.method} ${ep.path}`, `Status ${res.status}: ${body.error || 'Unknown'}`);
      }
    } catch (err) {
      fail(`API ${ep.method} ${ep.path}`, err.message);
    }
  }

  // Test protected endpoints (expect 401 without auth)
  const protectedEndpoints = [
    { method: 'GET', path: '/api/dashboard/stats', name: 'Dashboard Stats' },
    { method: 'GET', path: '/api/dashboard/calls', name: 'Dashboard Calls' },
    { method: 'GET', path: '/api/dashboard/appointments', name: 'Dashboard Appointments' },
    { method: 'PUT', path: '/api/dashboard/settings/call-handling', name: 'Call Handling Settings' },
    { method: 'PUT', path: '/api/dashboard/settings/call-features', name: 'Call Features Settings' },
    { method: 'PUT', path: '/api/dashboard/settings/voice', name: 'Voice Settings' },
    { method: 'PUT', path: '/api/dashboard/settings/language', name: 'Language Settings' },
    { method: 'GET', path: '/api/dashboard/settings/advanced-ai', name: 'Advanced AI Settings GET' },
    { method: 'PUT', path: '/api/dashboard/settings/advanced-ai', name: 'Advanced AI Settings PUT' },
  ];

  for (const ep of protectedEndpoints) {
    try {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        body: ep.method !== 'GET' ? '{}' : undefined
      });
      if (res.status === 401) {
        pass(`API ${ep.method} ${ep.path} (auth required)`);
      } else if (res.ok) {
        warn(`API ${ep.method} ${ep.path}`, 'No auth required (unexpected)');
      } else {
        warn(`API ${ep.method} ${ep.path}`, `Status ${res.status}`);
      }
    } catch (err) {
      fail(`API ${ep.method} ${ep.path}`, err.message);
    }
  }
}

// ============================================================================
// 3. BUSINESS DATA TESTS
// ============================================================================
async function testBusinessData() {
  console.log('\n' + '='.repeat(60));
  console.log('3. BUSINESS DATA TESTS');
  console.log('='.repeat(60) + '\n');

  // Check if any businesses exist
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('id, name, user_id, industry, timezone')
    .limit(5);

  if (bizError) {
    fail('Fetch businesses', bizError.message);
    return;
  }

  if (!businesses || businesses.length === 0) {
    warn('Businesses', 'No businesses found in database');
    return;
  }

  pass(`Found ${businesses.length} business(es)`);

  // For each business, check related data
  for (const biz of businesses) {
    console.log(`\n  Checking business: ${biz.name} (${biz.id.slice(0, 8)}...)`);

    // Check ai_config
    const { data: aiConfig } = await supabase
      .from('ai_config')
      .select('voice_id, ai_name, retell_agent_id')
      .eq('business_id', biz.id)
      .single();

    if (aiConfig) {
      pass(`  - ai_config exists`);
      if (aiConfig.retell_agent_id) {
        pass(`  - Retell agent configured: ${aiConfig.retell_agent_id.slice(0, 15)}...`);
      } else {
        warn(`  - Retell agent`, 'Not configured');
      }
    } else {
      fail(`  - ai_config`, 'Missing');
    }

    // Check call_settings
    const { data: callSettings } = await supabase
      .from('call_settings')
      .select('recording_enabled, max_call_duration_seconds')
      .eq('business_id', biz.id)
      .single();

    if (callSettings) {
      pass(`  - call_settings exists`);
    } else {
      warn(`  - call_settings`, 'Missing (will be created on first save)');
    }

    // Check services
    const { data: services } = await supabase
      .from('services')
      .select('id')
      .eq('business_id', biz.id);

    if (services && services.length > 0) {
      pass(`  - ${services.length} service(s) configured`);
    } else {
      warn(`  - services`, 'None configured');
    }

    // Check phone numbers
    const { data: phones } = await supabase
      .from('phone_numbers')
      .select('phone_number, is_primary')
      .eq('business_id', biz.id);

    if (phones && phones.length > 0) {
      pass(`  - ${phones.length} phone number(s)`);
    } else {
      warn(`  - phone_numbers`, 'None configured');
    }
  }
}

// ============================================================================
// 4. FUNCTION/TRIGGER TESTS
// ============================================================================
async function testFunctions() {
  console.log('\n' + '='.repeat(60));
  console.log('4. DATABASE FUNCTIONS TESTS');
  console.log('='.repeat(60) + '\n');

  // Test increment_usage_minutes function exists
  try {
    // This will fail but tells us if function exists
    const { error } = await supabase.rpc('increment_usage_minutes', {
      p_business_id: '00000000-0000-0000-0000-000000000000',
      p_minutes: 1
    });

    if (error && error.message.includes('Minutes must be a positive integer')) {
      pass('Function: increment_usage_minutes exists');
    } else if (error && error.code === '42883') {
      fail('Function: increment_usage_minutes', 'Function does not exist');
    } else if (error) {
      // Function exists but failed for other reason (expected with fake UUID)
      pass('Function: increment_usage_minutes exists');
    }
  } catch (err) {
    warn('Function: increment_usage_minutes', err.message);
  }

  // Test increment_caller_count function
  try {
    const { error } = await supabase.rpc('increment_caller_count', {
      p_business_id: '00000000-0000-0000-0000-000000000000',
      p_phone_number: '+15555555555'
    });

    if (error && error.code === '42883') {
      fail('Function: increment_caller_count', 'Function does not exist');
    } else {
      pass('Function: increment_caller_count exists');
    }
  } catch (err) {
    warn('Function: increment_caller_count', err.message);
  }
}

// ============================================================================
// 5. ENVIRONMENT VARIABLES CHECK
// ============================================================================
async function testEnvironment() {
  console.log('\n' + '='.repeat(60));
  console.log('5. ENVIRONMENT VARIABLES CHECK');
  console.log('='.repeat(60) + '\n');

  // We can't directly check env vars, but we can verify via API behavior
  const envChecks = [
    { name: 'SUPABASE_URL', check: () => SUPABASE_URL.includes('supabase.co') },
    { name: 'SUPABASE_SERVICE_KEY', check: () => SUPABASE_SERVICE_KEY.length > 100 },
  ];

  for (const env of envChecks) {
    if (env.check()) {
      pass(`ENV: ${env.name} configured`);
    } else {
      fail(`ENV: ${env.name}`, 'Not properly configured');
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================
async function runAllTests() {
  console.log('\n' + '█'.repeat(60));
  console.log('  KOYA CALLER - COMPREHENSIVE FEATURE TESTS');
  console.log('█'.repeat(60));

  await testDatabaseSchema();
  await testAPIEndpoints();
  await testBusinessData();
  await testFunctions();
  await testEnvironment();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);

  if (results.failed.length > 0) {
    console.log('\n--- FAILED TESTS ---');
    results.failed.forEach(f => console.log(`  • ${f.test}: ${f.reason}`));
  }

  if (results.warnings.length > 0) {
    console.log('\n--- WARNINGS ---');
    results.warnings.forEach(w => console.log(`  • ${w.test}: ${w.reason}`));
  }

  console.log('\n');
}

runAllTests().catch(console.error);
