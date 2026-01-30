/**
 * FULL SETUP CHECKER - Koya Caller
 * Checks all components needed for calls to work
 * Run with: node scripts/full-setup-check.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
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

const results = {
  passed: [],
  failed: [],
  warnings: []
};

function pass(msg) {
  results.passed.push(msg);
  console.log(`✅ ${msg}`);
}

function fail(msg, fix) {
  results.failed.push({ msg, fix });
  console.log(`❌ ${msg}`);
  if (fix) console.log(`   FIX: ${fix}`);
}

function warn(msg) {
  results.warnings.push(msg);
  console.log(`⚠️  ${msg}`);
}

async function checkUrl(url, name) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'GET',
      timeout: 10000,
      headers: {
        'User-Agent': 'Koya-Setup-Check/1.0'
      }
    };

    const req = https.request(options, (res) => {
      resolve({ ok: res.statusCode < 500, status: res.statusCode });
    });

    req.on('error', (e) => {
      resolve({ ok: false, error: e.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout' });
    });

    req.end();
  });
}

async function runChecks() {
  console.log('\n' + '='.repeat(60));
  console.log('KOYA CALLER - FULL SETUP CHECK');
  console.log('='.repeat(60) + '\n');

  // ========================================
  // 1. ENVIRONMENT VARIABLES
  // ========================================
  console.log('1. ENVIRONMENT VARIABLES');
  console.log('-'.repeat(40));

  const requiredEnvVars = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', name: 'Supabase URL' },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', name: 'Supabase Anon Key' },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', name: 'Supabase Service Key' },
    { key: 'TWILIO_ACCOUNT_SID', name: 'Twilio Account SID' },
    { key: 'TWILIO_AUTH_TOKEN', name: 'Twilio Auth Token' },
    { key: 'TWILIO_PHONE_NUMBER', name: 'Twilio Phone Number' },
    { key: 'RETELL_API_KEY', name: 'Retell API Key' },
    { key: 'NEXT_PUBLIC_APP_URL', name: 'App URL (ngrok)' },
  ];

  for (const { key, name } of requiredEnvVars) {
    if (process.env[key]) {
      pass(`${name} is set`);
    } else {
      fail(`${name} is MISSING`, `Add ${key} to .env.local`);
    }
  }

  // ========================================
  // 2. NGROK / APP URL ACCESSIBILITY
  // ========================================
  console.log('\n2. APP URL ACCESSIBILITY');
  console.log('-'.repeat(40));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    console.log(`   Testing: ${appUrl}`);
    const result = await checkUrl(appUrl, 'App URL');
    if (result.ok) {
      pass(`App URL is accessible (status: ${result.status})`);
    } else {
      fail(`App URL is NOT accessible: ${result.error || result.status}`,
           'Make sure ngrok is running and the URL matches .env.local');
    }

    // Test webhook endpoint specifically
    const webhookUrl = `${appUrl}/api/twilio/webhook`;
    console.log(`   Testing: ${webhookUrl}`);
    const webhookResult = await checkUrl(webhookUrl, 'Webhook');
    if (webhookResult.ok || webhookResult.status === 405) {
      pass(`Webhook endpoint exists (status: ${webhookResult.status})`);
    } else {
      fail(`Webhook endpoint issue: ${webhookResult.error || webhookResult.status}`,
           'Make sure Next.js dev server is running (npm run dev)');
    }
  }

  // ========================================
  // 3. SUPABASE DATABASE
  // ========================================
  console.log('\n3. SUPABASE DATABASE');
  console.log('-'.repeat(40));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && supabaseKey) {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check tables exist
    const tables = ['businesses', 'phone_numbers', 'ai_config', 'calls'];
    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error && error.message.includes('does not exist')) {
        fail(`Table "${table}" does not exist`, 'Run database migrations');
      } else if (error) {
        warn(`Table "${table}" error: ${error.message}`);
      } else {
        pass(`Table "${table}" exists`);
      }
    }

    // Check phone number is registered
    const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
    const { data: phoneData } = await supabase
      .from('phone_numbers')
      .select('*, businesses(name, subscription_status)')
      .eq('number', twilioNumber)
      .single();

    if (phoneData) {
      pass(`Phone ${twilioNumber} is registered to business: ${phoneData.businesses?.name || 'Unknown'}`);
      if (!phoneData.is_active) {
        fail('Phone number is NOT active', 'Update phone_numbers set is_active = true');
      }
      if (phoneData.businesses?.subscription_status !== 'active') {
        warn(`Business subscription status is "${phoneData.businesses?.subscription_status}" (not "active")`);
      }
    } else {
      fail(`Phone ${twilioNumber} is NOT registered in database`,
           'Complete onboarding or manually add to phone_numbers table');
    }

    // Check AI config
    if (phoneData?.business_id) {
      const { data: aiConfig } = await supabase
        .from('ai_config')
        .select('retell_agent_id')
        .eq('business_id', phoneData.business_id)
        .single();

      if (aiConfig?.retell_agent_id) {
        pass(`Retell Agent ID is configured: ${aiConfig.retell_agent_id}`);
      } else {
        fail('No Retell Agent ID configured', 'Add retell_agent_id to ai_config table');
      }
    }
  }

  // ========================================
  // 4. TWILIO CONFIGURATION
  // ========================================
  console.log('\n4. TWILIO CONFIGURATION');
  console.log('-'.repeat(40));

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (accountSid && authToken && phoneNumber) {
    try {
      const twilio = require('twilio')(accountSid, authToken);

      // Check phone number exists
      const numbers = await twilio.incomingPhoneNumbers.list({ phoneNumber });

      if (numbers.length === 0) {
        fail(`Phone ${phoneNumber} not found in Twilio account`);
      } else {
        const num = numbers[0];
        pass(`Phone ${phoneNumber} exists in Twilio`);

        // Check webhook URL
        const expectedUrl = `${appUrl}/api/twilio/webhook`;
        if (num.voiceUrl === expectedUrl) {
          pass(`Twilio webhook URL is correct`);
        } else if (!num.voiceUrl) {
          fail('Twilio webhook URL is NOT set',
               `Configure voice URL to: ${expectedUrl}`);
        } else {
          fail(`Twilio webhook URL is wrong: ${num.voiceUrl}`,
               `Should be: ${expectedUrl}`);
        }

        // Check voice method
        if (num.voiceMethod === 'POST') {
          pass('Twilio voice method is POST');
        } else {
          warn(`Twilio voice method is ${num.voiceMethod} (should be POST)`);
        }
      }
    } catch (e) {
      fail(`Twilio API error: ${e.message}`);
    }
  }

  // ========================================
  // 5. RETELL CONFIGURATION
  // ========================================
  console.log('\n5. RETELL CONFIGURATION');
  console.log('-'.repeat(40));

  const retellApiKey = process.env.RETELL_API_KEY;

  if (retellApiKey) {
    try {
      const Retell = require('retell-sdk');
      const client = new Retell.default({ apiKey: retellApiKey });

      // List agents
      const agents = await client.agent.list();
      pass(`Retell API connected - found ${agents.length} agent(s)`);

      if (agents.length > 0) {
        for (const agent of agents.slice(0, 3)) {
          console.log(`   - ${agent.agent_name} (${agent.agent_id})`);
        }
      }

      // Check specific agent from database
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: aiConfig } = await supabase
        .from('ai_config')
        .select('retell_agent_id')
        .limit(1)
        .single();

      if (aiConfig?.retell_agent_id) {
        try {
          const agent = await client.agent.retrieve(aiConfig.retell_agent_id);
          pass(`Database agent exists in Retell: ${agent.agent_name}`);
        } catch (e) {
          fail(`Database agent ID not found in Retell: ${aiConfig.retell_agent_id}`,
               'Create agent in Retell or update ai_config');
        }
      }
    } catch (e) {
      fail(`Retell API error: ${e.message}`);
    }
  }

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);

  if (results.failed.length > 0) {
    console.log('\n🔴 ISSUES TO FIX:');
    results.failed.forEach((f, i) => {
      console.log(`\n${i + 1}. ${f.msg}`);
      if (f.fix) console.log(`   → ${f.fix}`);
    });
  }

  if (results.failed.length === 0) {
    console.log('\n🟢 ALL CHECKS PASSED! Try making a test call.');
  }

  console.log('\n');
}

runChecks().catch(console.error);
