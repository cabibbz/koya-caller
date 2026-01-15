/**
 * Check Twilio SIP credentials
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

async function check() {
  console.log('\n========================================');
  console.log('TWILIO SIP TRUNK FULL DETAILS');
  console.log('========================================\n');

  // Get trunk
  const trunks = await twilio.trunking.v1.trunks.list();
  const trunk = trunks.find(t => t.friendlyName === 'Retell-AI');

  if (!trunk) {
    console.log('Trunk not found!');
    return;
  }

  console.log('TRUNK: ' + trunk.friendlyName);
  console.log('SID: ' + trunk.sid);

  // Get termination
  console.log('\n--- TERMINATION (Retell calls TO Twilio) ---');
  console.log('Domain Name: ' + (trunk.domainName || 'NOT SET'));

  // The termination URI is based on the domain name
  if (trunk.domainName) {
    console.log('Termination URI: sip:' + trunk.domainName);
  } else {
    console.log('⚠️  No termination domain set!');
    console.log('   You need to set this in Twilio Console → Elastic SIP Trunking → Trunks → Retell-AI → Termination');
  }

  // Get origination URLs
  console.log('\n--- ORIGINATION (Twilio calls TO Retell) ---');
  const origination = await twilio.trunking.v1.trunks(trunk.sid).originationUrls.list();
  if (origination.length === 0) {
    console.log('❌ No origination URLs!');
  } else {
    origination.forEach(o => {
      console.log('URL: ' + o.sipUrl);
      console.log('Enabled: ' + o.enabled);
    });
  }

  // Get credential lists
  console.log('\n--- CREDENTIALS ---');
  const credLists = await twilio.trunking.v1.trunks(trunk.sid).credentialsLists.list();

  if (credLists.length === 0) {
    console.log('No credential lists attached to trunk');
  } else {
    for (const cl of credLists) {
      console.log('Credential List: ' + cl.friendlyName + ' (' + cl.sid + ')');

      // Get credentials in this list
      const creds = await twilio.sip.credentialLists(cl.sid).credentials.list();
      console.log('  Usernames in this list:');
      creds.forEach(c => {
        console.log('    - ' + c.username);
      });
    }
  }

  // Summary
  console.log('\n========================================');
  console.log('WHAT TO CHECK IN RETELL');
  console.log('========================================\n');

  if (trunk.domainName) {
    console.log('When you imported the number in Retell, you should have entered:');
    console.log('');
    console.log('  Termination URI: sip:' + trunk.domainName);
    console.log('  Username: (one of the usernames above, like "richard13")');
    console.log('  Password: (the password you set for that username)');
  } else {
    console.log('❌ PROBLEM: Your Twilio trunk has no Termination domain!');
    console.log('');
    console.log('Go to Twilio Console → Elastic SIP Trunking → Trunks → Retell-AI');
    console.log('Click "Termination" tab and set up a Termination SIP URI');
  }

  console.log('\n');
}

check().catch(console.error);
