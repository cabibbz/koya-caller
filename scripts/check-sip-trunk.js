/**
 * Check Twilio SIP Trunk configuration
 * Run with: node scripts/check-sip-trunk.js
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

async function checkSipTrunk() {
  console.log('\n========================================');
  console.log('TWILIO SIP TRUNK CONFIGURATION');
  console.log('========================================\n');

  const twilio = require('twilio')(accountSid, authToken);

  try {
    const trunks = await twilio.trunking.v1.trunks.list();

    for (const trunk of trunks) {
      console.log(`Trunk: ${trunk.friendlyName}`);
      console.log('-'.repeat(50));
      console.log(`SID: ${trunk.sid}`);
      console.log(`Domain: ${trunk.domainName}`);
      console.log(`Secure: ${trunk.secure}`);
      console.log(`Transfer Mode: ${trunk.transferMode}`);
      console.log(`Disaster Recovery: ${trunk.disasterRecoveryUrl || 'Not set'}`);

      // Get origination URLs (where calls FROM Twilio go TO)
      console.log('\nOrigination URLs (outbound to SIP):');
      const origination = await twilio.trunking.v1
        .trunks(trunk.sid)
        .originationUrls
        .list();

      if (origination.length === 0) {
        console.log('  ❌ NO ORIGINATION URLs CONFIGURED');
        console.log('  This means Twilio cannot send calls to Retell via SIP trunk');
      } else {
        origination.forEach(o => {
          console.log(`  - ${o.sipUrl}`);
          console.log(`    Weight: ${o.weight}, Priority: ${o.priority}`);
          console.log(`    Enabled: ${o.enabled}`);
        });
      }

      // Get phone numbers associated with trunk
      console.log('\nPhone Numbers on this trunk:');
      const phoneNumbers = await twilio.trunking.v1
        .trunks(trunk.sid)
        .phoneNumbers
        .list();

      if (phoneNumbers.length === 0) {
        console.log('  ❌ NO PHONE NUMBERS ASSOCIATED');
      } else {
        phoneNumbers.forEach(p => {
          console.log(`  - ${p.phoneNumber}`);
        });
      }

      // Get credential lists
      console.log('\nCredential Lists:');
      const credLists = await twilio.trunking.v1
        .trunks(trunk.sid)
        .credentialsLists
        .list();

      if (credLists.length === 0) {
        console.log('  No credential lists (using IP-based auth or none)');
      } else {
        credLists.forEach(c => {
          console.log(`  - ${c.friendlyName}`);
        });
      }

      // Get IP Access Control Lists
      console.log('\nIP Access Control Lists:');
      const ipLists = await twilio.trunking.v1
        .trunks(trunk.sid)
        .ipAccessControlLists
        .list();

      if (ipLists.length === 0) {
        console.log('  No IP ACLs configured');
      } else {
        ipLists.forEach(ip => {
          console.log(`  - ${ip.friendlyName}`);
        });
      }

      console.log('\n');
    }

  } catch (e) {
    console.log('Error:', e.message);
  }
}

checkSipTrunk().catch(console.error);
