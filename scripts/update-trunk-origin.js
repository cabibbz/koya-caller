/**
 * Update SIP trunk origination URL
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
  // Get current origination URLs
  const origins = await twilio.trunking.v1.trunks(trunkSid).originationUrls.list();

  console.log('Current origination URLs:');
  for (const o of origins) {
    console.log(`  - ${o.sipUrl} (enabled: ${o.enabled})`);

    // Delete old one
    console.log(`    Deleting...`);
    await twilio.trunking.v1.trunks(trunkSid).originationUrls(o.sid).remove();
  }

  // Add new LiveKit URL
  console.log('\nAdding LiveKit origination URL...');
  await twilio.trunking.v1.trunks(trunkSid).originationUrls.create({
    sipUrl: 'sip:5t4n6j0wnrl.sip.livekit.cloud',
    weight: 10,
    priority: 10,
    enabled: true,
    friendlyName: 'Retell LiveKit'
  });

  console.log('✅ Done!');

  // Verify
  const newOrigins = await twilio.trunking.v1.trunks(trunkSid).originationUrls.list();
  console.log('\nNew origination URLs:');
  for (const o of newOrigins) {
    console.log(`  - ${o.sipUrl}`);
  }
}

main().catch(console.error);
