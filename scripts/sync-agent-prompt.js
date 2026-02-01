/**
 * Sync Retell agent prompt with Koya knowledge base
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

const Retell = require('retell-sdk').default;
const { createClient } = require('@supabase/supabase-js');

const retell = new Retell({ apiKey: process.env.RETELL_API_KEY });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const businessId = '5a0a09c7-2050-485a-b803-3fd6d556c534'; // Netapp

async function main() {
  console.log('Syncing Retell agent with Koya knowledge base...\n');

  // Get business info
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  console.log('Business:', business?.name);

  // Get AI config
  const { data: aiConfig } = await supabase
    .from('ai_config')
    .select('*')
    .eq('business_id', businessId)
    .single();

  console.log('AI Name:', aiConfig?.ai_name);
  console.log('Personality:', aiConfig?.personality);
  console.log('Agent ID:', aiConfig?.retell_agent_id);

  // Get FAQs
  const { data: faqs } = await supabase
    .from('faqs')
    .select('question, answer')
    .eq('business_id', businessId)
    .order('sort_order');

  console.log('FAQs:', faqs?.length || 0);

  // Get services
  const { data: services } = await supabase
    .from('services')
    .select('name, description, duration_minutes, price_cents')
    .eq('business_id', businessId)
    .order('sort_order');

  console.log('Services:', services?.length || 0);

  // Get knowledge
  const { data: knowledge } = await supabase
    .from('knowledge')
    .select('content')
    .eq('business_id', businessId)
    .single();

  console.log('Additional Knowledge:', knowledge?.content ? 'Yes' : 'No');

  // Get business hours
  const { data: hours } = await supabase
    .from('business_hours')
    .select('*')
    .eq('business_id', businessId)
    .order('day_of_week');

  console.log('Business Hours configured:', hours?.length || 0, 'days');

  // Display current knowledge base
  console.log('\n' + '='.repeat(60));
  console.log('CURRENT KNOWLEDGE BASE');
  console.log('='.repeat(60));

  if (faqs && faqs.length > 0) {
    console.log('\nFAQs:');
    faqs.forEach((f, i) => {
      console.log(`  ${i+1}. Q: ${f.question}`);
      console.log(`     A: ${f.answer.substring(0, 100)}${f.answer.length > 100 ? '...' : ''}`);
    });
  } else {
    console.log('\nNo FAQs configured');
  }

  if (services && services.length > 0) {
    console.log('\nServices:');
    services.forEach(s => {
      const price = s.price_cents ? `$${(s.price_cents/100).toFixed(0)}` : 'N/A';
      console.log(`  - ${s.name} (${s.duration_minutes} min, ${price})`);
    });
  } else {
    console.log('\nNo services configured');
  }

  if (knowledge?.content) {
    console.log('\nAdditional Knowledge:');
    console.log('  ' + knowledge.content.substring(0, 200) + '...');
  }

  // Now regenerate the prompt
  console.log('\n' + '='.repeat(60));
  console.log('REGENERATING AGENT PROMPT...');
  console.log('='.repeat(60));

  if (!aiConfig?.retell_agent_id) {
    console.log('No Retell agent configured!');
    return;
  }

  // Build FAQ section
  const faqSection = faqs && faqs.length > 0
    ? faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
    : 'No FAQs available.';

  // Build services section
  const servicesSection = services && services.length > 0
    ? services.map(s => {
        const price = s.price_cents ? `$${(s.price_cents/100).toFixed(0)}` : 'Price varies';
        return `- ${s.name}: ${s.description || 'No description'} (${s.duration_minutes} min, ${price})`;
      }).join('\n')
    : 'No services configured.';

  // Build the new system prompt
  const personality = aiConfig?.personality || 'professional';
  const personalityDesc = {
    professional: 'professional, courteous, and business-appropriate',
    friendly: 'warm, friendly, and conversational',
    casual: 'relaxed, casual, and approachable'
  }[personality] || 'professional';

  const systemPrompt = `# Personality
You are ${aiConfig?.ai_name || 'Koya'}, the ${personalityDesc} voice receptionist for ${business?.name || 'the business'}. ${business?.differentiator || ''}

# Environment
You handle incoming phone calls. Callers may be existing customers, potential customers, or individuals wanting to schedule appointments. All interactions occur via voice telephone calls where clarity and brevity are essential.

# Goal
1. Answer incoming calls with a warm greeting
2. Listen to the caller's needs and identify their purpose
3. If asked about services or common questions, provide concise answers from the FAQ section
4. If the caller wants to schedule, use check_availability then book_appointment
5. If the caller requests to speak with someone or has an emergency, use transfer_call
6. If after hours or caller prefers, use take_message
7. Confirm details before finalizing any action
8. Close calls professionally with end_call

# Services Offered
${servicesSection}

# Frequently Asked Questions
${faqSection}

${knowledge?.content ? `# Additional Information\n${knowledge.content}` : ''}

# Tools
- **check_availability(date, service?)** - Check available appointment times
- **book_appointment(date, time, customer_name, customer_phone, service, notes?)** - Book an appointment
- **transfer_call(reason)** - Transfer to a person
- **take_message(caller_name, caller_phone, message, urgency)** - Take a message
- **send_sms(message, to_number?)** - Send a text message
- **end_call(reason)** - End the call professionally`;

  console.log('\nNew prompt preview (first 500 chars):');
  console.log(systemPrompt.substring(0, 500) + '...\n');

  // Get current agent to find LLM ID
  const agent = await retell.agent.retrieve(aiConfig.retell_agent_id);
  const llmId = agent.response_engine?.llm_id;

  if (!llmId) {
    console.log('No LLM ID found on agent!');
    return;
  }

  console.log('Updating LLM', llmId, '...');

  // Update the LLM with new prompt
  await retell.llm.update(llmId, {
    general_prompt: systemPrompt,
  });

  console.log('\n✓ Agent prompt updated successfully!');
  console.log('Try calling again - the AI should now have the correct information.');
}

main().catch(console.error);
