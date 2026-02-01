/**
 * Check language configuration
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('\n========================================');
  console.log('LANGUAGE CONFIGURATION CHECK');
  console.log('========================================\n');

  // Get ai_config
  const { data: config } = await supabase
    .from('ai_config')
    .select('*')
    .single();

  if (!config) {
    console.log('❌ No AI config found!');
    return;
  }

  console.log('AI Config:');
  console.log('  Spanish Enabled:', config.spanish_enabled ? '✓ YES' : '❌ NO');
  console.log('  Language Mode:', config.language_mode || 'NOT SET');
  console.log('  Voice ID:', config.voice_id);
  console.log('  Greeting:', config.greeting?.substring(0, 50) + '...');
  console.log('  Spanish Greeting:', config.greeting_spanish || 'NOT SET');
  console.log('  Retell Agent ID:', config.retell_agent_id);
  console.log('  Retell Agent ID (Spanish):', config.retell_agent_id_spanish || 'NOT SET');

  // Check Retell agent
  console.log('\n----------------------------------------');
  console.log('RETELL AGENT CHECK');
  console.log('----------------------------------------\n');

  const Retell = require('retell-sdk');
  const retell = new Retell({ apiKey: process.env.RETELL_API_KEY });

  try {
    const agent = await retell.agent.retrieve(config.retell_agent_id);
    console.log('Agent Name:', agent.agent_name);
    console.log('Voice ID:', agent.voice_id);
    console.log('Language:', agent.language || 'NOT SET (defaults to en-US)');
    console.log('Voice Model:', agent.voice_model || 'NOT SET');

    if (agent.language === 'multi' || agent.voice_model === 'eleven_multilingual_v2') {
      console.log('\n✓ Agent is configured for multilingual support');
    } else {
      console.log('\n❌ Agent is NOT configured for multilingual!');
      console.log('   To fix: language should be "multi" and voice_model should be "eleven_multilingual_v2"');
    }
  } catch (err) {
    console.log('Error fetching agent:', err.message);
  }
}

check().catch(console.error);
