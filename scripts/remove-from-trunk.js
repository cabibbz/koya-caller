/**
 * Remove phone number from SIP trunk
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
const trunkSid = 'TKdd66a2461d844ade1e20129f4fb1a1ab';

async function main() {
  // Get phone numbers on trunk
  const phoneNumbers = await twilio.trunking.v1.trunks(trunkSid).phoneNumbers.list();

  console.log('Phone numbers on trunk:');
  for (const p of phoneNumbers) {
    console.log(`  - ${p.phoneNumber} (${p.sid})`);
    console.log('    Removing from trunk...');
    await twilio.trunking.v1.trunks(trunkSid).phoneNumbers(p.sid).remove();
    console.log('    ✅ Removed');
  }

  if (phoneNumbers.length === 0) {
    console.log('  No phone numbers on trunk');
  }

  console.log('\nDone! Phone number will now use webhook directly.');
}

main().catch(console.error);
