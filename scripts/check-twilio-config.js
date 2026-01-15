/**
 * Check Twilio phone number webhook configuration
 * Run with: node scripts/check-twilio-config.js
 */

const fs = require('fs');
const path = require('path');

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

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
const appUrl = process.env.NEXT_PUBLIC_APP_URL;

async function checkTwilioConfig() {
  console.log('\n========================================');
  console.log('TWILIO CONFIGURATION CHECK');
  console.log('========================================\n');

  console.log(`Expected webhook URL: ${appUrl}/api/twilio/webhook`);
  console.log(`Phone number: ${phoneNumber}\n`);

  if (!accountSid || !authToken) {
    console.log('❌ Twilio credentials missing');
    return;
  }

  const twilio = require('twilio')(accountSid, authToken);

  try {
    // List incoming phone numbers
    const numbers = await twilio.incomingPhoneNumbers.list({ phoneNumber });

    if (numbers.length === 0) {
      console.log(`❌ Phone number ${phoneNumber} not found in Twilio account!`);
      return;
    }

    const number = numbers[0];
    console.log('Phone Number Configuration:');
    console.log('---------------------------');
    console.log(`   SID: ${number.sid}`);
    console.log(`   Number: ${number.phoneNumber}`);
    console.log(`   Friendly Name: ${number.friendlyName}`);
    console.log(`   Voice URL: ${number.voiceUrl || '❌ NOT SET'}`);
    console.log(`   Voice Method: ${number.voiceMethod || 'N/A'}`);
    console.log(`   Voice Fallback: ${number.voiceFallbackUrl || 'Not set'}`);
    console.log(`   Status Callback: ${number.statusCallback || 'Not set'}`);

    const expectedUrl = `${appUrl}/api/twilio/webhook`;

    if (number.voiceUrl === expectedUrl) {
      console.log('\n✓ Voice URL is correctly configured!');
    } else if (!number.voiceUrl) {
      console.log('\n❌ PROBLEM: Voice URL is NOT configured!');
      console.log(`   FIX: Set voice URL to: ${expectedUrl}`);
      console.log('\n   Would you like me to configure it? Run:');
      console.log(`   node scripts/check-twilio-config.js --fix`);
    } else {
      console.log(`\n⚠ Voice URL is set but different from expected:`);
      console.log(`   Current: ${number.voiceUrl}`);
      console.log(`   Expected: ${expectedUrl}`);
    }

    // Check if we should fix it
    if (process.argv.includes('--fix')) {
      console.log('\nUpdating Twilio webhook configuration...');

      await twilio.incomingPhoneNumbers(number.sid).update({
        voiceUrl: expectedUrl,
        voiceMethod: 'POST',
        statusCallback: `${appUrl}/api/twilio/status`,
        statusCallbackMethod: 'POST',
      });

      console.log('✓ Webhook URL updated successfully!');
    }

  } catch (error) {
    console.log('❌ Error checking Twilio configuration:', error.message);
  }

  console.log('\n');
}

checkTwilioConfig().catch(console.error);
