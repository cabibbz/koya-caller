/**
 * Fix call logging and analytics configuration
 */

const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '..', '.env.local');
const content = fs.readFileSync(envPath, 'utf-8');
content.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && trimmed.indexOf('=') > 0 && !trimmed.startsWith('#')) {
    const key = trimmed.substring(0, trimmed.indexOf('='));
    let value = trimmed.substring(trimmed.indexOf('=') + 1);
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    process.env[key] = value;
  }
});

const Retell = require('retell-sdk');
const retell = new Retell({ apiKey: process.env.RETELL_API_KEY });

const agentId = 'agent_a42afc929376c54d66c010c58a';

async function fix() {
  console.log('\n========================================');
  console.log('FIXING CALL LOGGING & ANALYTICS');
  console.log('========================================\n');

  const webhookUrl = process.env.NEXT_PUBLIC_APP_URL + '/api/retell/webhook';

  console.log('Updating agent with:');
  console.log('  - Webhook URL:', webhookUrl);
  console.log('  - Recording: enabled');

  await retell.agent.update(agentId, {
    webhook_url: webhookUrl,
    enable_recording: true,
    // Post-call analysis with correct format
    post_call_analysis_data: [
      {
        type: 'string',
        name: 'call_summary',
        description: 'A brief summary of what the caller wanted and the outcome',
      },
      {
        type: 'string',
        name: 'customer_name',
        description: 'The name of the caller if provided',
      },
      {
        type: 'string',
        name: 'service_requested',
        description: 'The service the caller asked about',
      },
      {
        type: 'boolean',
        name: 'appointment_booked',
        description: 'Whether an appointment was booked',
      },
    ],
  });

  console.log('\n✓ Agent updated successfully!');

  // Verify
  const agent = await retell.agent.retrieve(agentId);
  console.log('\nVerification:');
  console.log('  Webhook URL:', agent.webhook_url);
  console.log('  Recording:', agent.enable_recording ? 'enabled' : 'disabled');
  console.log('  Post-call analysis:', agent.post_call_analysis_data?.length || 0, 'fields');

  console.log('\n========================================');
  console.log('✓ CALL LOGGING FIXED!');
  console.log('========================================');
  console.log('\nNew calls will now:');
  console.log('  - Send webhooks to your server for logging');
  console.log('  - Be recorded for playback');
  console.log('  - Generate call summaries');
}

fix().catch(console.error);
