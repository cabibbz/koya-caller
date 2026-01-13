const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const RETELL_API_KEY = envVars.RETELL_API_KEY;
const AGENT_ID = 'agent_a42afc929376c54d66c010c58a';

async function checkAll() {
  // Get agent
  const agentRes = await fetch('https://api.retellai.com/get-agent/' + AGENT_ID, {
    headers: { Authorization: 'Bearer ' + RETELL_API_KEY }
  });

  if (!agentRes.ok) {
    console.log('Agent fetch failed:', agentRes.status);
    console.log(await agentRes.text());
    return;
  }

  const agent = await agentRes.json();
  console.log('=== AGENT ===');
  console.log('ID:', agent.agent_id);
  console.log('Name:', agent.agent_name);
  console.log('Voice:', agent.voice_id);
  console.log('LLM ID:', agent.response_engine?.llm_id);

  // Get LLM
  if (agent.response_engine && agent.response_engine.llm_id) {
    const llmRes = await fetch('https://api.retellai.com/get-retell-llm/' + agent.response_engine.llm_id, {
      headers: { Authorization: 'Bearer ' + RETELL_API_KEY }
    });

    if (!llmRes.ok) {
      console.log('\nLLM fetch failed:', llmRes.status);
      console.log(await llmRes.text());
      return;
    }

    const llm = await llmRes.json();
    console.log('\n=== LLM ===');
    console.log('ID:', llm.llm_id);
    console.log('Model:', llm.model);
    console.log('Begin Message:', llm.begin_message);
    console.log('Has Prompt:', llm.general_prompt ? 'Yes (' + llm.general_prompt.length + ' chars)' : 'NO - MISSING!');

    if (!llm.general_prompt) {
      console.log('\n*** ERROR: No general_prompt! This will cause calls to fail! ***');
    }
  }
}

checkAll().catch(e => console.log('Error:', e.message));
