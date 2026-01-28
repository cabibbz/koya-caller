/**
 * Fix SIP trunk configuration
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
  const trunks = await twilio.trunking.v1.trunks.list();

  for (const trunk of trunks) {
    console.log(`\nTrunk: ${trunk.friendlyName}`);
    console.log(`  SID: ${trunk.sid}`);
    console.log(`  Transfer Mode: ${trunk.transferMode}`);
    console.log(`  Secure: ${trunk.secure}`);

    // Check if transfer mode is disabled
    if (trunk.transferMode === 'disable-all') {
      console.log('\n  ⚠️  Transfer mode is disabled. This might block SIP outbound.');
      console.log('  Updating to "sip-only"...');

      await twilio.trunking.v1.trunks(trunk.sid).update({
        transferMode: 'enable-all'  // or 'sip-only'
      });

      console.log('  ✅ Transfer mode updated to enable-all');
    }

    // Disable secure mode (Retell may not support TLS)
    if (trunk.secure) {
      console.log('\n  Disabling secure mode...');
      await twilio.trunking.v1.trunks(trunk.sid).update({
        secure: false
      });
      console.log('  ✅ Secure mode disabled');
    }
  }
}

main().catch(console.error);
