/**
 * Enable Spanish support and reconfigure Retell agent
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
const Retell = require('retell-sdk');
const retell = new Retell({ apiKey: process.env.RETELL_API_KEY });

async function enableSpanish() {
  console.log('\n========================================');
  console.log('ENABLING SPANISH SUPPORT');
  console.log('========================================\n');

  // Get current config
  const { data: config } = await supabase
    .from('ai_config')
    .select('*')
    .single();

  if (!config) {
    console.log('❌ No AI config found!');
    return;
  }

  const businessId = config.business_id;
  const agentId = config.retell_agent_id;

  // Get business name
  const { data: business } = await supabase
    .from('businesses')
    .select('name')
    .eq('id', businessId)
    .single();

  const businessName = business?.name || 'our business';

  console.log('1. Updating database settings...');

  // Update ai_config with Spanish settings
  const { error: updateError } = await supabase
    .from('ai_config')
    .update({
      spanish_enabled: true,
      language_mode: 'auto',
      greeting_spanish: `Gracias por llamar a ${businessName}. Soy Koya, ¿en qué puedo ayudarle hoy?`,
    })
    .eq('business_id', businessId);

  if (updateError) {
    console.log('❌ Error updating database:', updateError.message);
    return;
  }
  console.log('   ✓ Database updated');

  console.log('\n2. Updating Retell agent for multilingual...');

  try {
    // Update agent to multilingual
    await retell.agent.update(agentId, {
      language: 'multi',
      voice_model: 'eleven_multilingual_v2',
      // Add Spanish backchannel words
      backchannel_words: [
        'yeah', 'uh-huh', 'mhm', 'I see', 'right', 'got it',
        'sí', 'ajá', 'vale', 'entiendo', 'claro', 'ya veo'
      ],
    });
    console.log('   ✓ Agent updated to multilingual mode');
  } catch (err) {
    console.log('   ❌ Error updating agent:', err.message);
    return;
  }

  console.log('\n3. Updating LLM with language instructions...');

  try {
    // Get current agent to find LLM ID
    const agent = await retell.agent.retrieve(agentId);
    const llmId = agent.response_engine?.llm_id;

    if (llmId) {
      // Get current LLM
      const llm = await retell.llm.retrieve(llmId);

      // Update with language detection instruction
      const currentPrompt = llm.general_prompt || '';
      const languageInstruction = `

## Language
Listen for the caller's language in their first response.
If they speak Spanish, respond in Spanish for the rest of the call.
If they speak English, respond in English for the rest of the call.
If unclear, default to English.
You are fluent in both English and Spanish.
`;

      // Only add if not already there
      if (!currentPrompt.includes('Listen for the caller\'s language')) {
        await retell.llm.update(llmId, {
          general_prompt: currentPrompt + languageInstruction,
        });
        console.log('   ✓ LLM updated with language detection');
      } else {
        console.log('   ✓ LLM already has language detection');
      }
    }
  } catch (err) {
    console.log('   ⚠ Could not update LLM:', err.message);
  }

  console.log('\n========================================');
  console.log('✓ SPANISH SUPPORT ENABLED!');
  console.log('========================================');
  console.log('\nTry calling and speaking Spanish - Koya should detect and respond in Spanish.');
  console.log('\nSettings applied:');
  console.log('  - spanish_enabled: true');
  console.log('  - language_mode: auto (detect from caller)');
  console.log('  - Agent language: multi');
  console.log('  - Voice model: eleven_multilingual_v2');
}

enableSpanish().catch(console.error);
