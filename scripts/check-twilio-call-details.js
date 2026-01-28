/**
 * Check detailed Twilio call info including SIP responses
 * Run with: node scripts/check-twilio-call-details.js
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

async function checkCallDetails() {
  console.log('\n========================================');
  console.log('TWILIO CALL DETAILS (with SIP info)');
  console.log('========================================\n');

  const twilio = require('twilio')(accountSid, authToken);

  // Get recent calls
  const calls = await twilio.calls.list({
    to: phoneNumber,
    limit: 5
  });

  for (const call of calls) {
    console.log(`\nCall: ${call.sid}`);
    console.log('-'.repeat(50));
    console.log(`Status: ${call.status}`);
    console.log(`Duration: ${call.duration}s`);
    console.log(`From: ${call.from}`);
    console.log(`Start: ${call.startTime}`);
    console.log(`End: ${call.endTime}`);

    // Try to get call feedback/quality
    try {
      const feedback = await twilio.calls(call.sid).feedback().fetch();
      console.log(`Feedback: ${JSON.stringify(feedback)}`);
    } catch (e) {
      // No feedback available
    }

    // Get call events
    try {
      const events = await twilio.calls(call.sid).events.list({ limit: 20 });
      if (events.length > 0) {
        console.log('\nCall Events:');
        events.forEach(e => {
          console.log(`  ${e.timestamp} - ${e.name}`);
          if (e.description) console.log(`    ${e.description}`);
        });
      }
    } catch (e) {
      // Events not available
    }

    // Get call recordings
    try {
      const recordings = await twilio.recordings.list({ callSid: call.sid });
      if (recordings.length > 0) {
        console.log(`\nRecordings: ${recordings.length}`);
      }
    } catch (e) {
      // Recordings not available
    }

    // Check SIP response code in the call properties
    if (call.answeredBy) console.log(`Answered By: ${call.answeredBy}`);
    if (call.callerName) console.log(`Caller Name: ${call.callerName}`);

    // Look for any error info
    try {
      const notifications = await twilio.calls(call.sid).notifications.list();
      if (notifications.length > 0) {
        console.log('\nNotifications/Errors:');
        notifications.forEach(n => {
          console.log(`  [${n.log}] ${n.messageText}`);
          if (n.errorCode) console.log(`    Error Code: ${n.errorCode}`);
          if (n.moreInfo) console.log(`    More Info: ${n.moreInfo}`);
        });
      }
    } catch (e) {
      // Notifications not available
    }
  }

  // Also check for any recent SIP trunk activity
  console.log('\n\n========================================');
  console.log('CHECKING SIP SETTINGS');
  console.log('========================================\n');

  try {
    // List SIP trunks
    const trunks = await twilio.trunking.v1.trunks.list();
    console.log(`SIP Trunks configured: ${trunks.length}`);
    trunks.forEach(t => {
      console.log(`  - ${t.friendlyName} (${t.sid})`);
    });
  } catch (e) {
    console.log('No SIP trunks or error fetching:', e.message);
  }

  console.log('\n');
}

checkCallDetails().catch(console.error);
