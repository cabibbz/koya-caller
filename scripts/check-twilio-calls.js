/**
 * Check recent Twilio call logs
 * Run with: node scripts/check-twilio-calls.js
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

async function checkTwilioCalls() {
  console.log('\n========================================');
  console.log('TWILIO CALL LOGS');
  console.log('========================================\n');

  if (!accountSid || !authToken) {
    console.log('❌ Twilio credentials missing');
    return;
  }

  const twilio = require('twilio')(accountSid, authToken);

  try {
    // Get recent calls to this number
    const calls = await twilio.calls.list({
      to: phoneNumber,
      limit: 10
    });

    console.log(`Recent incoming calls to ${phoneNumber}:`);
    console.log('------------------------------------------\n');

    if (calls.length === 0) {
      console.log('   No recent incoming calls found.');
      console.log('   Try calling the number to generate logs.');
    } else {
      for (const call of calls) {
        console.log(`Call SID: ${call.sid}`);
        console.log(`   From: ${call.from}`);
        console.log(`   Status: ${call.status}`);
        console.log(`   Duration: ${call.duration}s`);
        console.log(`   Direction: ${call.direction}`);
        console.log(`   Start Time: ${call.startTime}`);
        console.log(`   End Time: ${call.endTime}`);

        // Try to get call events/notifications
        try {
          const notifications = await twilio.calls(call.sid).notifications.list();
          if (notifications.length > 0) {
            console.log(`   ⚠ Notifications/Errors:`);
            notifications.forEach(n => {
              console.log(`      - ${n.messageText}`);
            });
          }
        } catch (e) {
          // Ignore notification fetch errors
        }

        console.log('');
      }
    }

    // Also check outbound calls (might have test calls)
    console.log('\nRecent outbound calls from this number:');
    console.log('----------------------------------------\n');

    const outboundCalls = await twilio.calls.list({
      from: phoneNumber,
      limit: 5
    });

    if (outboundCalls.length === 0) {
      console.log('   No recent outbound calls.');
    } else {
      outboundCalls.forEach(call => {
        console.log(`   ${call.to} - ${call.status} (${call.duration}s)`);
      });
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n');
}

checkTwilioCalls().catch(console.error);
