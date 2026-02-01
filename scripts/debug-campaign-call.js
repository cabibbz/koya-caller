/**
 * Debug what dynamic variables are being passed to Retell for campaign calls
 */

const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '..', '.env.local');
const content = fs.readFileSync(envPath, 'utf-8');
content.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) return;
  let value = trimmed.substring(eqIndex + 1);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[trimmed.substring(0, eqIndex)] = value;
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const businessId = '5a0a09c7-2050-485a-b803-3fd6d556c534'; // Netapp

async function main() {
  console.log('=== DEBUG CAMPAIGN CALL DATA ===\n');

  // Get most recent campaigns
  const { data: campaigns } = await supabase
    .from('outbound_campaigns')
    .select('id, name, type, settings, status')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(3);

  if (!campaigns || campaigns.length === 0) {
    console.log('No campaigns found!');
    return;
  }

  console.log('Recent Campaigns:');
  for (const campaign of campaigns) {
    console.log(`\n--- Campaign: ${campaign.name} ---`);
    console.log('  ID:', campaign.id);
    console.log('  Type:', campaign.type);
    console.log('  Status:', campaign.status);
    console.log('  Settings:', JSON.stringify(campaign.settings, null, 2));

    // Get queue items for this campaign
    const { data: queueItems } = await supabase
      .from('outbound_call_queue')
      .select('id, contact_phone, contact_name, status, dynamic_variables')
      .eq('campaign_id', campaign.id)
      .limit(3);

    if (queueItems && queueItems.length > 0) {
      console.log('\n  Queue Items:');
      for (const item of queueItems) {
        console.log(`    - ${item.contact_name} (${item.contact_phone})`);
        console.log('      Status:', item.status);
        console.log('      Dynamic Variables:', JSON.stringify(item.dynamic_variables, null, 6));
      }
    } else {
      console.log('\n  No queue items');
    }
  }

  // Now simulate what prepareDynamicVariables would produce
  console.log('\n\n=== SIMULATED DYNAMIC VARIABLES ===');

  if (campaigns[0]) {
    const campaign = campaigns[0];
    const settings = campaign.settings || {};
    const customMessage = settings.custom_message;

    console.log('\nCampaign custom_message:', customMessage || '(empty)');

    // Simulate prepareDynamicVariables
    const purpose = campaign.type === 'appointment_reminder' ? 'reminder'
      : campaign.type === 'follow_up' ? 'followup'
      : 'custom';

    const vars = {
      business_name: 'Netapp',
      ai_name: 'Koya',
      is_outbound: 'true',
      outbound_purpose: purpose,
      outbound_instructions: customMessage || '',
      greeting: purpose === 'reminder'
        ? 'Hi, this is Koya calling from Netapp. I\'m calling to remind you about your upcoming appointment.'
        : purpose === 'followup'
        ? 'Hi, this is Koya calling from Netapp. I\'m following up with you regarding your recent visit.'
        : 'Hi, this is Koya calling from Netapp. How are you doing today?',
    };

    console.log('\nWhat would be sent to Retell:');
    console.log(JSON.stringify(vars, null, 2));

    console.log('\n--- KEY ISSUE CHECK ---');
    if (!customMessage) {
      console.log('❌ PROBLEM: custom_message is empty in campaign settings!');
      console.log('   The campaign was created/updated without a custom_message.');
      console.log('   The AI has no outbound_instructions to follow.');
    } else {
      console.log('✓ custom_message is set:', customMessage);
      console.log('\nVerify the Retell prompt contains: {{outbound_instructions}}');
    }
  }
}

main();
