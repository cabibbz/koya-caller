/**
 * Check call details including child calls (SIP attempts)
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.substring(0, eqIndex);
    let value = trimmed.substring(eqIndex + 1);
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}
loadEnv();

const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function main() {
  // Get most recent call
  const calls = await twilio.calls.list({
    to: process.env.TWILIO_PHONE_NUMBER,
    limit: 3
  });

  for (const call of calls) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Parent Call: ${call.sid}`);
    console.log(`From: ${call.from} -> To: ${call.to}`);
    console.log(`Status: ${call.status}`);
    console.log(`Duration: ${call.duration}s`);
    console.log(`Start: ${call.startTime}`);

    // Get child calls (outbound SIP dial attempts)
    const childCalls = await twilio.calls.list({
      parentCallSid: call.sid
    });

    if (childCalls.length === 0) {
      console.log('\nNo child calls (SIP dial attempts)');
    } else {
      console.log(`\nChild calls (${childCalls.length}):`);
      for (const child of childCalls) {
        console.log(`  - ${child.sid}`);
        console.log(`    To: ${child.to}`);
        console.log(`    Status: ${child.status}`);
        console.log(`    Duration: ${child.duration}s`);

        // Get SIP response code if available
        if (child.sipResponseCode) {
          console.log(`    SIP Response: ${child.sipResponseCode}`);
        }
      }
    }

    // Get call events/notifications
    try {
      const notifications = await twilio.calls(call.sid).notifications.list();
      if (notifications.length > 0) {
        console.log('\nNotifications/Errors:');
        for (const n of notifications) {
          console.log(`  - [${n.log}] ${n.messageText}`);
        }
      }
    } catch (e) {
      // Ignore
    }
  }
}

main().catch(console.error);
