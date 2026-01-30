/**
 * Update Retell Agent Responsiveness Settings
 *
 * This script updates the agent to be more responsive and
 * immediately stop talking when the caller starts speaking.
 */

const fs = require('fs');
const path = require('path');

// Read .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
});

const RETELL_API_KEY = envVars.RETELL_API_KEY;
const AGENT_ID = 'agent_a42afc929376c54d66c010c58a'; // Your agent ID

async function updateAgentSettings() {
  if (!RETELL_API_KEY) {
    console.error('RETELL_API_KEY not found in .env.local');
    process.exit(1);
  }

  console.log('Fetching current agent settings...');

  // First get current agent
  const getRes = await fetch(`https://api.retellai.com/get-agent/${AGENT_ID}`, {
    headers: { Authorization: `Bearer ${RETELL_API_KEY}` },
  });

  if (!getRes.ok) {
    console.error('Failed to fetch agent:', await getRes.text());
    process.exit(1);
  }

  const agent = await getRes.json();
  console.log('\nCurrent settings:');
  console.log('- responsiveness:', agent.responsiveness ?? 'default');
  console.log('- interruption_sensitivity:', agent.interruption_sensitivity ?? 'default');
  console.log('- enable_backchannel:', agent.enable_backchannel ?? 'default');
  console.log('- voice_speed:', agent.voice_speed ?? 'default');

  // Update with optimized settings for responsiveness
  console.log('\nUpdating agent with optimized settings...');

  const updateRes = await fetch(`https://api.retellai.com/update-agent/${AGENT_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${RETELL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // Maximum responsiveness - responds faster
      responsiveness: 1.0,

      // Maximum interruption sensitivity - stops immediately when caller talks
      interruption_sensitivity: 1.0,

      // Enable backchannel for natural conversation
      enable_backchannel: true,

      // Slightly faster voice speed for quicker responses
      voice_speed: 1.1,

      // Reduce end call after silence to 10 seconds
      end_call_after_silence_ms: 10000,
    }),
  });

  if (!updateRes.ok) {
    console.error('Failed to update agent:', await updateRes.text());
    process.exit(1);
  }

  const updated = await updateRes.json();
  console.log('\nUpdated settings:');
  console.log('- responsiveness:', updated.responsiveness);
  console.log('- interruption_sensitivity:', updated.interruption_sensitivity);
  console.log('- enable_backchannel:', updated.enable_backchannel);
  console.log('- voice_speed:', updated.voice_speed);
  console.log('- end_call_after_silence_ms:', updated.end_call_after_silence_ms);

  console.log('\nAgent updated successfully!');
  console.log('Koya will now:');
  console.log('  - Respond faster to callers');
  console.log('  - Stop talking immediately when interrupted');
  console.log('  - Use natural backchannel sounds (mm-hmm, etc.)');
}

updateAgentSettings().catch(console.error);
