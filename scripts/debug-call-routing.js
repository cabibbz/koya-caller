/**
 * Debug script to check call routing configuration
 * Run with: node scripts/debug-call-routing.js
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

    // Remove quotes if present
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
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
const retellApiKey = process.env.RETELL_API_KEY;

async function debugCallRouting() {
  console.log('\n========================================');
  console.log('KOYA CALLER - CALL ROUTING DEBUG');
  console.log('========================================\n');

  // Check environment variables
  console.log('1. ENVIRONMENT VARIABLES');
  console.log('------------------------');
  console.log(`   SUPABASE_URL: ${supabaseUrl ? '✓ Set' : '✗ MISSING'}`);
  console.log(`   SERVICE_ROLE_KEY: ${supabaseServiceKey ? '✓ Set' : '✗ MISSING'}`);
  console.log(`   TWILIO_PHONE_NUMBER: ${twilioNumber || '✗ MISSING'}`);
  console.log(`   RETELL_API_KEY: ${retellApiKey ? '✓ Set' : '✗ MISSING'}`);
  console.log(`   APP_URL: ${process.env.NEXT_PUBLIC_APP_URL || '✗ MISSING'}`);

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('\n❌ Cannot continue - Supabase credentials missing');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check phone number registration
  console.log('\n2. PHONE NUMBER LOOKUP');
  console.log('----------------------');

  const { data: phoneRecords, error: phoneError } = await supabase
    .from('phone_numbers')
    .select('*');

  if (phoneError) {
    console.log(`   ❌ Error querying phone_numbers: ${phoneError.message}`);
  } else if (!phoneRecords || phoneRecords.length === 0) {
    console.log('   ❌ NO PHONE NUMBERS FOUND IN DATABASE');
    console.log('   → This is why calls hang up! The number is not registered.');
  } else {
    console.log(`   Found ${phoneRecords.length} phone number(s):`);
    phoneRecords.forEach(p => {
      console.log(`   - ${p.number} (active: ${p.is_active}, business_id: ${p.business_id})`);
    });

    // Check if Twilio number is registered
    const twilioRecord = phoneRecords.find(p => p.number === twilioNumber);
    if (twilioRecord) {
      console.log(`   ✓ Twilio number ${twilioNumber} IS registered`);
    } else {
      console.log(`   ❌ Twilio number ${twilioNumber} is NOT registered!`);
    }
  }

  // Check businesses
  console.log('\n3. BUSINESSES');
  console.log('-------------');

  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('id, name, subscription_status, timezone, plan_id');

  if (bizError) {
    console.log(`   ❌ Error querying businesses: ${bizError.message}`);
  } else if (!businesses || businesses.length === 0) {
    console.log('   ❌ NO BUSINESSES FOUND IN DATABASE');
  } else {
    console.log(`   Found ${businesses.length} business(es):`);
    businesses.forEach(b => {
      console.log(`   - ${b.name} (id: ${b.id.substring(0, 8)}..., status: ${b.subscription_status})`);
    });
  }

  // Check AI configs
  console.log('\n4. AI CONFIGURATIONS');
  console.log('--------------------');

  const { data: aiConfigs, error: aiError } = await supabase
    .from('ai_config')
    .select('business_id, retell_agent_id, retell_agent_id_spanish, language_mode');

  if (aiError) {
    console.log(`   ❌ Error querying ai_config: ${aiError.message}`);
  } else if (!aiConfigs || aiConfigs.length === 0) {
    console.log('   ❌ NO AI CONFIGS FOUND IN DATABASE');
    console.log('   → Calls will fall back to basic IVR, not AI');
  } else {
    console.log(`   Found ${aiConfigs.length} AI config(s):`);
    aiConfigs.forEach(c => {
      console.log(`   - Business: ${c.business_id.substring(0, 8)}...`);
      console.log(`     Retell Agent ID: ${c.retell_agent_id || '❌ NOT SET'}`);
      console.log(`     Spanish Agent ID: ${c.retell_agent_id_spanish || 'Not set'}`);
      console.log(`     Language Mode: ${c.language_mode}`);
    });
  }

  // Check call settings
  console.log('\n5. CALL SETTINGS');
  console.log('----------------');

  const { data: callSettings, error: csError } = await supabase
    .from('call_settings')
    .select('business_id, after_hours_action, transfer_number');

  if (csError) {
    console.log(`   ❌ Error querying call_settings: ${csError.message}`);
  } else if (!callSettings || callSettings.length === 0) {
    console.log('   ⚠ No call settings found (will use defaults)');
  } else {
    console.log(`   Found ${callSettings.length} call setting(s)`);
  }

  // Check business hours
  console.log('\n6. BUSINESS HOURS');
  console.log('-----------------');

  const { data: hours, error: hoursError } = await supabase
    .from('business_hours')
    .select('business_id, day_of_week, is_closed, open_time, close_time');

  if (hoursError) {
    console.log(`   ❌ Error querying business_hours: ${hoursError.message}`);
  } else if (!hours || hours.length === 0) {
    console.log('   ⚠ No business hours set (will default to always open)');
  } else {
    console.log(`   Found ${hours.length} business hour entries`);
  }

  // Summary
  console.log('\n========================================');
  console.log('DIAGNOSIS');
  console.log('========================================\n');

  const hasPhoneNumber = phoneRecords && phoneRecords.some(p => p.number === twilioNumber && p.is_active);
  const hasBusiness = businesses && businesses.length > 0;
  const hasRetellAgent = aiConfigs && aiConfigs.some(c => c.retell_agent_id);

  if (!hasPhoneNumber) {
    console.log('❌ PROBLEM: Phone number not registered in database');
    console.log('   FIX: You need to complete onboarding or manually add the phone number');
  }

  if (!hasBusiness) {
    console.log('❌ PROBLEM: No business exists in database');
    console.log('   FIX: Complete the onboarding flow to create a business');
  }

  if (!hasRetellAgent) {
    console.log('❌ PROBLEM: No Retell agent ID configured');
    console.log('   FIX: Create a Retell agent and add the ID to ai_config');
  }

  if (hasPhoneNumber && hasBusiness && hasRetellAgent) {
    console.log('✓ Basic configuration looks correct');
    console.log('   If calls still hang up, check:');
    console.log('   1. Twilio webhook URL is set to your ngrok URL');
    console.log('   2. ngrok is running and accessible');
    console.log('   3. Retell agent is active in Retell dashboard');
  }

  console.log('\n');
}

debugCallRouting().catch(console.error);
