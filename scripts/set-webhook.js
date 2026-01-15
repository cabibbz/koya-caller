/**
 * Set Twilio webhook URL
 * Run with: node scripts/set-webhook.js
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
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnv();

const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

async function setWebhook() {
  console.log('Looking for phone number:', phoneNumber);

  const numbers = await twilio.incomingPhoneNumbers.list({ phoneNumber });
  if (numbers.length === 0) {
    console.log('❌ Phone number not found');
    return;
  }

  const num = numbers[0];
  console.log('Current voice URL:', num.voiceUrl || 'NOT SET');
  console.log('Setting webhook to:', appUrl + '/api/twilio/webhook');

  await twilio.incomingPhoneNumbers(num.sid).update({
    voiceUrl: appUrl + '/api/twilio/webhook',
    voiceMethod: 'POST',
    voiceFallbackUrl: appUrl + '/api/twilio/fallback',
    voiceFallbackMethod: 'POST'
  });

  console.log('✅ Webhook URL configured successfully!');
}

setWebhook().catch(console.error);
