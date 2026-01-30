/**
 * Check phone numbers configured in Retell
 * Run with: node scripts/check-retell-phone-numbers.js
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

const retellApiKey = process.env.RETELL_API_KEY;

async function checkRetellPhoneNumbers() {
  console.log('\n========================================');
  console.log('RETELL PHONE NUMBERS');
  console.log('========================================\n');

  const Retell = require('retell-sdk');
  const client = new Retell.default({ apiKey: retellApiKey });

  try {
    // List all phone numbers in Retell
    const phoneNumbers = await client.phoneNumber.list();

    if (phoneNumbers.length === 0) {
      console.log('❌ NO PHONE NUMBERS IMPORTED INTO RETELL');
      console.log('\nThis is the problem! You need to import your Twilio number into Retell.');
      console.log('\nSteps to import:');
      console.log('1. Go to Retell Dashboard → Phone Numbers');
      console.log('2. Click "Import Number" or "Add Phone Number"');
      console.log('3. Select "Twilio" as the provider');
      console.log('4. Enter your Twilio SIP trunk termination URI');
      console.log('5. Enter the credentials (username/password from Twilio)');
      console.log('6. Import the number +14074568607');
      console.log('7. Assign it to your agent "Frodya - Koya"');
    } else {
      console.log(`Found ${phoneNumbers.length} phone number(s) in Retell:\n`);

      phoneNumbers.forEach(pn => {
        console.log(`Number: ${pn.phone_number}`);
        console.log(`  Phone Number ID: ${pn.phone_number_id || 'N/A'}`);
        console.log(`  Agent ID: ${pn.agent_id || '❌ NO AGENT ASSIGNED'}`);
        console.log(`  Inbound Agent ID: ${pn.inbound_agent_id || 'N/A'}`);
        console.log(`  Outbound Agent ID: ${pn.outbound_agent_id || 'N/A'}`);
        console.log(`  Area Code: ${pn.area_code || 'N/A'}`);
        console.log(`  Nickname: ${pn.nickname || 'N/A'}`);
        console.log('');
      });

      // Check if our specific number is there
      const ourNumber = '+14074568607';
      const found = phoneNumbers.find(pn =>
        pn.phone_number === ourNumber ||
        pn.phone_number === ourNumber.replace('+1', '') ||
        pn.phone_number === ourNumber.replace('+', '')
      );

      if (found) {
        console.log(`✅ Your number ${ourNumber} IS in Retell`);
        if (found.agent_id || found.inbound_agent_id) {
          console.log(`   Assigned to agent: ${found.agent_id || found.inbound_agent_id}`);
        } else {
          console.log(`   ⚠️ BUT no agent is assigned to it!`);
        }
      } else {
        console.log(`❌ Your number ${ourNumber} is NOT in Retell`);
        console.log('   You need to import it from your Twilio SIP trunk');
      }
    }

  } catch (e) {
    console.log('Error:', e.message);
    if (e.status === 401) {
      console.log('API key may be invalid');
    }
  }

  // Also list agents for reference
  console.log('\n========================================');
  console.log('AVAILABLE AGENTS');
  console.log('========================================\n');

  try {
    const agents = await client.agent.list();
    agents.forEach(a => {
      console.log(`- ${a.agent_name} (${a.agent_id})`);
    });
  } catch (e) {
    console.log('Error listing agents:', e.message);
  }

  console.log('\n');
}

checkRetellPhoneNumbers().catch(console.error);
