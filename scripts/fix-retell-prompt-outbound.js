/**
 * Fix Retell prompt to support outbound calls and custom instructions
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
const Retell = require('retell-sdk').default;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const retell = new Retell({ apiKey: process.env.RETELL_API_KEY });

const businessId = '5a0a09c7-2050-485a-b803-3fd6d556c534'; // Netapp

async function main() {
  console.log('=== FIXING RETELL PROMPT FOR OUTBOUND SUPPORT ===\n');

  // Get business data
  const { data: business } = await supabase
    .from('businesses')
    .select('name')
    .eq('id', businessId)
    .single();

  const { data: aiConfig } = await supabase
    .from('ai_config')
    .select('ai_name, greeting, retell_agent_id, system_prompt')
    .eq('business_id', businessId)
    .single();

  const { data: faqs } = await supabase
    .from('faqs')
    .select('question, answer')
    .eq('business_id', businessId)
    .order('sort_order');

  const { data: services } = await supabase
    .from('services')
    .select('name, description')
    .eq('business_id', businessId)
    .order('sort_order');

  console.log('Business:', business?.name);
  console.log('AI Name:', aiConfig?.ai_name);
  console.log('Agent ID:', aiConfig?.retell_agent_id);

  // Build FAQ section
  const faqSection = faqs && faqs.length > 0
    ? faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
    : 'No FAQs available.';

  // Build services section
  const servicesSection = services && services.length > 0
    ? services.map(s => `- ${s.name}: ${s.description || 'No description'}`).join('\n')
    : 'No services configured.';

  // Build the FIXED prompt with outbound support and dynamic variables
  const fixedPrompt = `# Personality
You are ${aiConfig?.ai_name || 'Koya'}, the professional, courteous, and business-appropriate voice receptionist for ${business?.name || 'the business'}. You maintain a formal demeanor at all times while being helpful and efficient.

# Environment
You handle both incoming AND outgoing phone calls.
- For INBOUND calls: Callers may be existing customers, potential customers, or individuals wanting to schedule appointments.
- For OUTBOUND calls: You are calling on behalf of the business, following specific instructions provided.
All interactions occur via voice telephone calls where clarity and brevity are essential.

# Dynamic Variables (Updated Each Call)
- is_outbound: {{is_outbound}} (true/false)
- outbound_purpose: {{outbound_purpose}} (reminder/followup/custom)
- outbound_instructions: {{outbound_instructions}} (your specific instructions for this call)

# Goal - INBOUND Calls (when is_outbound is "false" or not set)
1. Answer with the greeting (provided in begin_message)
2. Listen to the caller's needs and identify their purpose
3. If asked about services or common questions, provide concise answers from the FAQ section
4. If the caller wants to schedule, use check_availability then book_appointment
5. If the caller requests to speak with someone or has an emergency, use transfer_call
6. If after hours or caller prefers, use take_message
7. Confirm details before finalizing any action
8. Close calls professionally with end_call

# Goal - OUTBOUND Calls (when is_outbound is "true")
**This section is CRITICAL for outbound calls.**

1. Start with the greeting (provided in begin_message)
2. **READ AND FOLLOW the outbound_instructions variable** - this contains your specific instructions for this call
3. Based on the outbound_purpose:
   - "reminder": Remind the customer about their upcoming appointment
   - "followup": Follow up on a previous visit or inquiry
   - "custom": Follow the exact instructions in outbound_instructions
4. Be conversational and natural while achieving the call's objective
5. If the person is busy, offer to call back at a better time
6. End professionally using end_call

# Custom Instructions
**IMPORTANT:** When outbound_instructions contains a value, you MUST follow those instructions. They override the default behavior.
Current instructions: {{outbound_instructions}}

# Services Offered
${servicesSection}

# Frequently Asked Questions
${faqSection}

# Tools
- **check_availability(date, service?)** - Check available appointment times
- **book_appointment(date, time, customer_name, customer_phone, service, notes?)** - Book an appointment
- **transfer_call(reason)** - Transfer to a person
- **take_message(caller_name, caller_phone, message, urgency)** - Take a message
- **send_sms(message, to_number?)** - Send a text message
- **end_call(reason)** - End the call professionally

# Guardrails
- Never fabricate information not provided in your knowledge base
- Always verify and repeat back critical information
- If unsure, offer to take a message or transfer
- For outbound calls, ALWAYS follow the outbound_instructions if provided`;

  console.log('\n--- New Prompt Preview (first 1000 chars) ---');
  console.log(fixedPrompt.substring(0, 1000) + '...\n');

  // Get agent and LLM
  const agent = await retell.agent.retrieve(aiConfig.retell_agent_id);
  const llmId = agent.response_engine?.llm_id;

  if (!llmId) {
    console.log('No LLM ID found!');
    return;
  }

  // Fix the greeting - use the one from DB or generate correct one
  let greeting = aiConfig.greeting;
  if (!greeting || greeting.includes('mikes electric')) {
    greeting = `Thanks for calling ${business?.name || 'us'}, this is ${aiConfig?.ai_name || 'Koya'}, how can I help you today?`;
    // Also update in DB
    await supabase
      .from('ai_config')
      .update({ greeting })
      .eq('business_id', businessId);
    console.log('Fixed greeting in database');
  }

  console.log('Greeting:', greeting);
  console.log('LLM ID:', llmId);

  // Update LLM with fixed prompt AND correct begin_message
  // Using dynamic variable for greeting so it can be overridden for outbound
  await retell.llm.update(llmId, {
    general_prompt: fixedPrompt,
    begin_message: '{{greeting}}',  // Use dynamic variable!
  });

  // Update agent name
  await retell.agent.update(aiConfig.retell_agent_id, {
    agent_name: `${business?.name} - ${aiConfig?.ai_name || 'Koya'}`,
  });

  console.log('\n✓ Fixed successfully!');
  console.log('  - Updated prompt with outbound support');
  console.log('  - Added {{outbound_instructions}} variable');
  console.log('  - Set begin_message to use {{greeting}} variable');
  console.log('  - Updated agent name');

  // Also update the stored system_prompt in DB
  await supabase
    .from('ai_config')
    .update({ system_prompt: fixedPrompt })
    .eq('business_id', businessId);

  console.log('  - Saved fixed prompt to database');

  // Verify
  console.log('\n--- Verification ---');
  const updatedLlm = await retell.llm.retrieve(llmId);
  console.log('Begin Message:', updatedLlm.begin_message);
  console.log('Prompt contains {{outbound_instructions}}:', updatedLlm.general_prompt?.includes('{{outbound_instructions}}'));
  console.log('Prompt contains {{is_outbound}}:', updatedLlm.general_prompt?.includes('{{is_outbound}}'));
}

main().catch(console.error);
