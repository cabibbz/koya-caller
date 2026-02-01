/**
 * Check Twilio phone number configuration
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

const client = twilio(accountSid, authToken);

async function main() {
  console.log('Checking Twilio phone number configuration...\n');
  console.log('Phone Number:', phoneNumber);
  console.log('Expected webhook: https://blossomless-oliva-figgier.ngrok-free.dev/api/retell/incoming\n');

  try {
    const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: phoneNumber });

    if (numbers.length === 0) {
      console.log('Phone number not found in your Twilio account!');
      return;
    }

    const number = numbers[0];
    console.log('='.repeat(60));
    console.log('TWILIO PHONE NUMBER CONFIGURATION');
    console.log('='.repeat(60));
    console.log('SID:', number.sid);
    console.log('Phone:', number.phoneNumber);
    console.log('\nVoice Configuration:');
    console.log('  Voice URL:', number.voiceUrl || 'NOT SET');
    console.log('  Voice Method:', number.voiceMethod || 'NOT SET');
    console.log('  Voice Fallback URL:', number.voiceFallbackUrl || 'NOT SET');
    console.log('  Status Callback:', number.statusCallback || 'NOT SET');

    const expectedUrl = 'https://blossomless-oliva-figgier.ngrok-free.dev/api/retell/incoming';
    if (number.voiceUrl !== expectedUrl) {
      console.log('\nWARNING: Voice URL does not match!');
      console.log('  Current:', number.voiceUrl);
      console.log('  Expected:', expectedUrl);
    } else {
      console.log('\nVoice URL is correctly configured!');
    }

  } catch (err) {
    console.log('Error:', err.message);
  }
}

main();
