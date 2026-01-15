/**
 * Activate business subscription
 * Run with: node scripts/activate-business.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function activateBusiness() {
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  // Find business by phone number
  const { data: phoneData } = await supabase
    .from('phone_numbers')
    .select('business_id')
    .eq('number', phoneNumber)
    .single();

  if (!phoneData) {
    console.log('❌ Phone number not found in database');
    return;
  }

  console.log('Business ID:', phoneData.business_id);

  // Get current status
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('name, subscription_status')
    .eq('id', phoneData.business_id)
    .single();

  if (!business) {
    console.log('❌ Business not found:', bizError?.message);
    return;
  }

  console.log('Business:', business.name);
  console.log('Current status:', business.subscription_status);

  // Update to active
  const { error } = await supabase
    .from('businesses')
    .update({
      subscription_status: 'active'
    })
    .eq('id', phoneData.business_id);

  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log('✅ Business activated!');
  }
}

activateBusiness().catch(console.error);
