/**
 * Quick sync script to add integration functions to LLM
 */
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
const LLM_ID = 'llm_6043315ef19be06edbd116f99a75';
// Use environment variable for APP_URL, fallback to production URL
const APP_URL = envVars.NEXT_PUBLIC_APP_URL || 'https://koyacaller.com';

const integrationFunctions = [
  {
    type: 'custom',
    name: 'check_inventory',
    description: 'Check if a product is in stock. Use when caller asks about product availability, stock levels, or if something is available.',
    parameters: {
      type: 'object',
      properties: {
        product_name: { type: 'string', description: 'Product name or description to search for' },
        quantity: { type: 'number', description: 'Quantity needed (default 1)' }
      },
      required: ['product_name']
    },
    speak_after_execution: true,
    url: APP_URL + '/api/retell/function'
  },
  {
    type: 'custom',
    name: 'check_order_status',
    description: 'Look up order status by order number or customer phone. Use when caller asks about their order, shipping, or delivery.',
    parameters: {
      type: 'object',
      properties: {
        order_number: { type: 'string', description: 'Order number or ID' },
        customer_phone: { type: 'string', description: 'Customer phone number' }
      },
      required: []
    },
    speak_after_execution: true,
    url: APP_URL + '/api/retell/function'
  },
  {
    type: 'custom',
    name: 'create_lead',
    description: 'Create a CRM lead/contact from caller info. Use after gathering interested caller details.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full name' },
        email: { type: 'string', description: 'Email address' },
        phone: { type: 'string', description: 'Phone number' },
        interest: { type: 'string', description: 'What they are interested in' },
        notes: { type: 'string', description: 'Additional notes' }
      },
      required: ['name', 'phone']
    },
    speak_after_execution: true,
    url: APP_URL + '/api/retell/function'
  },
  {
    type: 'custom',
    name: 'check_reservation_availability',
    description: 'Check restaurant or spa reservation availability. Use when caller asks about booking a table or appointment.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        time: { type: 'string', description: 'Preferred time' },
        party_size: { type: 'number', description: 'Number of guests' }
      },
      required: ['date', 'party_size']
    },
    speak_after_execution: true,
    url: APP_URL + '/api/retell/function'
  },
  {
    type: 'custom',
    name: 'process_payment',
    description: 'Collect payment from caller via SMS payment link. Only use when caller explicitly agrees to pay.',
    parameters: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount in dollars' },
        description: { type: 'string', description: 'What the payment is for' },
        send_receipt: { type: 'boolean', description: 'Send SMS receipt' }
      },
      required: ['amount', 'description']
    },
    speak_after_execution: true,
    url: APP_URL + '/api/retell/function'
  }
];

async function main() {
  console.log('Fetching current LLM config...');

  const getRes = await fetch('https://api.retellai.com/get-retell-llm/' + LLM_ID, {
    headers: {
      'Authorization': 'Bearer ' + RETELL_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  const llm = await getRes.json();
  const existingFunctions = llm.functions || [];

  // Retell uses general_tools, not functions
  const existingTools = llm.general_tools || [];
  console.log('Existing tools:', existingTools.map(f => f.name).join(', ') || 'none');

  // Merge - add new functions, keep existing
  const existingNames = existingTools.map(f => f.name);
  const newFunctions = integrationFunctions.filter(f => existingNames.indexOf(f.name) === -1);
  const allFunctions = [...existingTools, ...newFunctions];

  console.log('Adding:', newFunctions.map(f => f.name).join(', ') || 'none (already synced)');
  console.log('Total functions:', allFunctions.length);

  if (newFunctions.length === 0) {
    console.log('✓ All integration functions already synced!');
    return;
  }

  console.log('Updating LLM...');

  const updateRes = await fetch('https://api.retellai.com/update-retell-llm/' + LLM_ID, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + RETELL_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      general_tools: allFunctions
    })
  });

  if (updateRes.ok) {
    console.log('✓ Functions synced successfully!');
    console.log('New functions available:');
    newFunctions.forEach(f => console.log('  - ' + f.name));
  } else {
    const err = await updateRes.text();
    console.log('Error:', updateRes.status, err);
  }
}

main().catch(console.error);
