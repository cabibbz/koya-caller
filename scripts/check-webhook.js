/**
 * Check Retell webhook configuration
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

async function check() {
  console.log('\n========================================');
  console.log('RETELL WEBHOOK CHECK');
  console.log('========================================\n');

  const expectedUrl = process.env.NEXT_PUBLIC_APP_URL + '/api/retell/webhook';
  console.log('Expected webhook URL:', expectedUrl);

  const agent = await retell.agent.retrieve('agent_a42afc929376c54d66c010c58a');
  console.log('Current webhook URL:', agent.webhook_url || 'NOT SET');

  if (agent.webhook_url === expectedUrl) {
    console.log('\n✓ Webhook URL is correct');
  } else {
    console.log('\n❌ Webhook URL mismatch! Fixing...');

    await retell.agent.update('agent_a42afc929376c54d66c010c58a', {
      webhook_url: expectedUrl,
    });

    console.log('✓ Webhook URL updated to:', expectedUrl);
  }

  // Also check post_call_analysis_data
  console.log('\nPost-call analysis:', agent.post_call_analysis_data ? 'Configured' : 'NOT SET');
}

check().catch(console.error);
