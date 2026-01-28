/**
 * Check Twilio phone number webhook configuration
 */

const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '..', '.env.local');
const content = fs.readFileSync(envPath, 'utf-8');
content.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && trimmed.indexOf('=') > 0 && !trimmed.startsWith('#')) {
    const key = trimmed.substring(0, trimmed.indexOf('='));
    let value = trimmed.substring(trimmed.indexOf('=') + 1);
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    process.env[key] = value;
  }
});

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneSid = 'PN158ea36b506e82dd21b56b86d8814776';

if (!accountSid || !authToken) {
  console.log('Missing Twilio credentials');
  process.exit(1);
}

const client = require('twilio')(accountSid, authToken);

async function check() {
  console.log('\n========================================');
  console.log('TWILIO WEBHOOK CHECK');
  console.log('========================================\n');

  const phone = await client.incomingPhoneNumbers(phoneSid).fetch();

  console.log('Phone Number:', phone.phoneNumber);
  console.log('');
  console.log('Voice URL:', phone.voiceUrl || 'NOT SET');
  console.log('Voice Fallback URL:', phone.voiceFallbackUrl || 'NOT SET');
  console.log('Voice Method:', phone.voiceMethod);
  console.log('');

  const expectedUrl = process.env.NEXT_PUBLIC_APP_URL;
  console.log('Expected Base URL:', expectedUrl);
  console.log('Expected Voice URL:', expectedUrl + '/api/twilio/webhook');

  if (phone.voiceUrl && phone.voiceUrl.includes(expectedUrl)) {
    console.log('\n✓ Voice URL matches expected domain');
  } else {
    console.log('\n❌ Voice URL does NOT match! This is likely the problem.');
    console.log('   You need to update the Twilio webhook URL.');
  }
}

check().catch(err => console.error('Error:', err.message));
