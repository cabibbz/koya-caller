/**
 * Remove webhook URL to fix SIP trunk conflict
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

async function fix() {
  console.log('\n========================================');
  console.log('REMOVING WEBHOOK URL');
  console.log('========================================\n');

  const numbers = await twilio.incomingPhoneNumbers.list({ phoneNumber: process.env.TWILIO_PHONE_NUMBER });
  const n = numbers[0];

  console.log('Before:');
  console.log('  Voice URL: ' + (n.voiceUrl || 'NOT SET'));
  console.log('  Trunk SID: ' + (n.trunkSid || 'NOT SET'));

  // Remove the webhook URL
  await twilio.incomingPhoneNumbers(n.sid).update({
    voiceUrl: '',
    voiceMethod: 'POST',
    voiceFallbackUrl: '',
    statusCallback: ''
  });

  console.log('\n✅ Webhook URL removed!\n');

  // Verify
  const updated = await twilio.incomingPhoneNumbers(n.sid).fetch();
  console.log('After:');
  console.log('  Voice URL: ' + (updated.voiceUrl || 'NOT SET (empty)'));
  console.log('  Trunk SID: ' + (updated.trunkSid || 'NOT SET'));

  console.log('\n========================================');
  console.log('NEXT STEP: Test by calling +14074568607');
  console.log('========================================\n');
  console.log('The call should now route through the SIP trunk directly to Retell.');
  console.log('Retell will answer with your "Frodya - Koya" agent.\n');
}

fix().catch(console.error);
