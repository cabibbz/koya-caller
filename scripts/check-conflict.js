/**
 * Check for webhook/SIP trunk conflict
 */

const fs = require('fs');
const path = require('path');

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
    if ((value.startsWith('"') && value.endsWith('"'))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}
loadEnv();

const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function check() {
  const numbers = await twilio.incomingPhoneNumbers.list({ phoneNumber: process.env.TWILIO_PHONE_NUMBER });
  const n = numbers[0];

  console.log('\n========================================');
  console.log('CONFIGURATION CONFLICT CHECK');
  console.log('========================================\n');

  console.log('Phone Number: ' + n.phoneNumber);
  console.log('Voice URL: ' + (n.voiceUrl || 'NOT SET'));
  console.log('Trunk SID: ' + (n.trunkSid || 'NOT SET'));

  console.log('\n');

  if (n.voiceUrl && n.trunkSid) {
    console.log('❌ CONFLICT DETECTED!');
    console.log('');
    console.log('Both a webhook URL AND a SIP trunk are configured.');
    console.log('This causes the "user busy" error.');
    console.log('');
    console.log('FOR SIP TRUNK METHOD (Option A):');
    console.log('  → Remove the Voice URL (set to empty)');
    console.log('  → Let the SIP trunk handle all routing to Retell');
    console.log('');
    console.log('FOR WEBHOOK METHOD (Option B):');
    console.log('  → Remove the phone number from the SIP trunk');
    console.log('  → Keep the webhook URL');
  } else if (n.trunkSid && !n.voiceUrl) {
    console.log('✅ SIP Trunk method configured (no webhook)');
    console.log('   Calls should route directly through SIP trunk to Retell');
  } else if (n.voiceUrl && !n.trunkSid) {
    console.log('✅ Webhook method configured (no trunk)');
    console.log('   Calls will go to your webhook');
  } else {
    console.log('⚠️ Neither webhook nor trunk configured!');
  }

  console.log('\n');
}

check().catch(console.error);
