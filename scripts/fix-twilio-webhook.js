/**
 * Fix Twilio webhook URLs to point to current ngrok
 */

const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '..', '.env.local');
const content = fs.readFileSync(envPath, 'utf-8');
content.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) return;
  let value = trimmed.substring(eqIndex + 1);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[trimmed.substring(0, eqIndex)] = value;
});

const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;

const client = twilio(accountSid, authToken);

async function main() {
  console.log('Fixing Twilio webhook URLs...\n');
  console.log('New base URL:', appUrl);

  try {
    const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: phoneNumber });

    if (numbers.length === 0) {
      console.log('Phone number not found!');
      return;
    }

    const number = numbers[0];
    console.log('\nUpdating phone number:', number.phoneNumber);

    await client.incomingPhoneNumbers(number.sid).update({
      voiceUrl: appUrl + '/api/retell/incoming',
      voiceMethod: 'POST',
      voiceFallbackUrl: appUrl + '/api/twilio/fallback',
      voiceFallbackMethod: 'POST',
      statusCallback: appUrl + '/api/twilio/status',
      statusCallbackMethod: 'POST',
    });

    console.log('\nDone! Updated webhooks to:');
    console.log('  Voice URL:', appUrl + '/api/retell/incoming');
    console.log('  Fallback URL:', appUrl + '/api/twilio/fallback');
    console.log('  Status Callback:', appUrl + '/api/twilio/status');
    console.log('\nTry calling again now!');

  } catch (err) {
    console.log('Error:', err.message);
  }
}

main();
