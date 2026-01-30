/**
 * Sync Retell Functions Script
 * Updates the LLM with the latest function definitions
 */

const fs = require('fs');
const path = require('path');

// Load env
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
});

const RETELL_API_KEY = envVars.RETELL_API_KEY;
const AGENT_ID = 'agent_a42afc929376c54d66c010c58a';
const APP_URL = envVars.NEXT_PUBLIC_APP_URL || 'https://koyacaller.com';

// Define all functions (must match lib/retell/functions.ts)
const RETELL_FUNCTIONS = [
  {
    type: "custom",
    name: "find_next_available",
    description:
      "Find the next available appointment slot. Use this when a caller asks 'When is your next opening?' " +
      "or 'What's your earliest availability?' without specifying a date. This searches the next 14 days.",
    parameters: {
      type: "object",
      properties: {
        service: {
          type: "string",
          description: "Optional: The specific service being requested. Affects slot duration.",
        },
        preferred_time: {
          type: "string",
          enum: ["morning", "afternoon", "evening", "any"],
          description: "Optional: Preferred time of day. morning=before noon, afternoon=12-5pm, evening=after 5pm.",
        },
      },
      required: [],
    },
    speak_after_execution: true,
    url: `${APP_URL}/api/retell/function`,
  },
  {
    type: "custom",
    name: "check_availability",
    description:
      "Check available appointment times for a specific date and optionally a specific service. " +
      "Use this when a caller wants to know when they can book an appointment ON A SPECIFIC DATE.",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "The date to check availability for in YYYY-MM-DD format",
        },
        service: {
          type: "string",
          description:
            "Optional: The specific service being requested. If not provided, show general availability.",
        },
      },
      required: ["date"],
    },
    speak_after_execution: true,
    url: `${APP_URL}/api/retell/function`,
  },
  {
    type: "custom",
    name: "book_appointment",
    description:
      "Book an appointment for a caller. Collect all required information before calling this function: " +
      "customer name, phone number, preferred date, time, and service.",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Appointment date in YYYY-MM-DD format",
        },
        time: {
          type: "string",
          description: "Appointment time in HH:MM format (24-hour)",
        },
        customer_name: {
          type: "string",
          description: "Full name of the customer",
        },
        customer_phone: {
          type: "string",
          description: "Customer's phone number",
        },
        customer_email: {
          type: "string",
          description: "Optional: Customer's email address for confirmation",
        },
        service: {
          type: "string",
          description: "The service being booked",
        },
        notes: {
          type: "string",
          description: "Optional: Any additional notes or special requests",
        },
      },
      required: ["date", "time", "customer_name", "customer_phone", "service"],
    },
    speak_after_execution: true,
    url: `${APP_URL}/api/retell/function`,
  },
  {
    type: "custom",
    name: "transfer_call",
    description:
      "Transfer the call to the business owner. Use this when: " +
      "1) The caller specifically requests to speak with a person, " +
      "2) There's an emergency situation, " +
      "3) The caller is upset and needs human assistance, or " +
      "4) The question is beyond your knowledge.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Brief explanation of why the call is being transferred",
        },
      },
      required: ["reason"],
    },
    speak_after_execution: true,
    url: `${APP_URL}/api/retell/function`,
  },
  {
    type: "custom",
    name: "take_message",
    description:
      "Take a message when you cannot directly help the caller. Use this when: " +
      "1) Transfer attempt failed (no answer), " +
      "2) It's after hours and booking isn't available, " +
      "3) The business has exhausted their minutes, or " +
      "4) The caller prefers to leave a message.",
    parameters: {
      type: "object",
      properties: {
        caller_name: {
          type: "string",
          description: "Name of the caller leaving the message",
        },
        caller_phone: {
          type: "string",
          description: "Caller's phone number for callback",
        },
        message: {
          type: "string",
          description: "The message content",
        },
        urgency: {
          type: "string",
          enum: ["low", "normal", "high", "emergency"],
          description: "Urgency level of the message",
        },
      },
      required: ["caller_name", "caller_phone", "message", "urgency"],
    },
    speak_after_execution: true,
    url: `${APP_URL}/api/retell/function`,
  },
  {
    type: "custom",
    name: "send_sms",
    description:
      "Send an SMS text message to the caller. Use this to: " +
      "1) Send booking confirmation details, " +
      "2) Send business information or directions, " +
      "3) Send links that can't be communicated verbally.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The SMS message content (keep under 160 characters if possible)",
        },
        to_number: {
          type: "string",
          description: "Optional: Phone number to send to. Defaults to the caller's number.",
        },
      },
      required: ["message"],
    },
    speak_after_execution: true,
    url: `${APP_URL}/api/retell/function`,
  },
  {
    type: "custom",
    name: "end_call",
    description:
      "End the call politely. Use this when: " +
      "1) The caller's needs have been fully addressed, " +
      "2) The caller says goodbye or indicates they're done, " +
      "3) The caller requests to end the call.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Brief note about why the call ended (for logging)",
        },
      },
      required: ["reason"],
    },
    speak_after_execution: true,
    url: `${APP_URL}/api/retell/function`,
  },
  // ==========================================================================
  // Integration Functions - E-Commerce, CRM, Payments
  // ==========================================================================
  {
    type: "custom",
    name: "check_inventory",
    description:
      "Check if a product is in stock. Use this when a caller asks about product availability, " +
      "stock levels, or whether something is available for purchase. " +
      "Examples: 'Is X in stock?', 'Do you have Y available?', 'How many do you have?'",
    parameters: {
      type: "object",
      properties: {
        product_name: {
          type: "string",
          description: "The product name, SKU, or description to search for",
        },
        quantity: {
          type: "number",
          description: "The quantity the caller needs (default 1)",
        },
      },
      required: ["product_name"],
    },
    speak_after_execution: true,
    url: `${APP_URL}/api/retell/function`,
  },
  {
    type: "custom",
    name: "check_order_status",
    description:
      "Look up an order status by order number or customer phone number. " +
      "Use this when a caller asks about their order, shipping, or delivery. " +
      "Examples: 'Where is my order?', 'Has my order shipped?', 'What's the status of order #123?'",
    parameters: {
      type: "object",
      properties: {
        order_number: {
          type: "string",
          description: "The order number or ID to look up",
        },
        customer_phone: {
          type: "string",
          description: "The customer's phone number to find their orders",
        },
      },
      required: [],
    },
    speak_after_execution: true,
    url: `${APP_URL}/api/retell/function`,
  },
  {
    type: "custom",
    name: "create_lead",
    description:
      "Create a CRM lead or contact from the caller's information. " +
      "Use this after gathering the caller's details during an interested call. " +
      "This helps the business follow up with potential customers later.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The caller's full name",
        },
        email: {
          type: "string",
          description: "The caller's email address (if provided)",
        },
        phone: {
          type: "string",
          description: "The caller's phone number",
        },
        interest: {
          type: "string",
          description: "What the caller is interested in (product, service, etc.)",
        },
        notes: {
          type: "string",
          description: "Any additional notes about the conversation",
        },
      },
      required: ["name", "phone"],
    },
    speak_after_execution: true,
    url: `${APP_URL}/api/retell/function`,
  },
  {
    type: "custom",
    name: "check_reservation_availability",
    description:
      "Check availability for restaurant tables or spa/wellness appointments. " +
      "Use this when a caller wants to make a reservation and asks about availability. " +
      "Examples: 'Do you have a table for 4 tonight?', 'Is there availability for Saturday?'",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "The requested date in YYYY-MM-DD format",
        },
        time: {
          type: "string",
          description: "The preferred time (e.g., '7:00 PM', '19:00')",
        },
        party_size: {
          type: "number",
          description: "Number of guests or people",
        },
      },
      required: ["date", "party_size"],
    },
    speak_after_execution: true,
    url: `${APP_URL}/api/retell/function`,
  },
  {
    type: "custom",
    name: "process_payment",
    description:
      "Collect a payment from the caller by sending an SMS payment link. " +
      "ONLY use this when the caller explicitly agrees to pay over the phone. " +
      "Never initiate payment without clear consent. " +
      "Examples: 'I'd like to pay now', 'Can I pay over the phone?', 'Let me pay for that'",
    parameters: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "The payment amount in dollars (e.g., 50.00)",
        },
        description: {
          type: "string",
          description: "What the payment is for (service, product, deposit, etc.)",
        },
        send_receipt: {
          type: "boolean",
          description: "Whether to send an SMS receipt after payment (default true)",
        },
      },
      required: ["amount", "description"],
    },
    speak_after_execution: true,
    url: `${APP_URL}/api/retell/function`,
  },
];

async function syncFunctions() {
  console.log('Fetching agent...');

  // Get agent to find LLM ID
  const agentRes = await fetch(`https://api.retellai.com/get-agent/${AGENT_ID}`, {
    headers: { Authorization: `Bearer ${RETELL_API_KEY}` }
  });

  if (!agentRes.ok) {
    console.log('Agent fetch failed:', agentRes.status);
    console.log(await agentRes.text());
    return;
  }

  const agent = await agentRes.json();
  const llmId = agent.response_engine?.llm_id;

  if (!llmId) {
    console.log('No LLM ID found on agent');
    return;
  }

  console.log('Agent:', agent.agent_id);
  console.log('LLM ID:', llmId);

  // Update LLM with new functions
  console.log('\nUpdating LLM with functions...');
  console.log('Functions:', RETELL_FUNCTIONS.map(f => f.name).join(', '));

  const updateRes = await fetch(`https://api.retellai.com/update-retell-llm/${llmId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${RETELL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      general_tools: RETELL_FUNCTIONS
    })
  });

  if (!updateRes.ok) {
    console.log('Update failed:', updateRes.status);
    console.log(await updateRes.text());
    return;
  }

  const updated = await updateRes.json();
  console.log('\nSuccess! LLM updated.');
  console.log('Tools now:', updated.general_tools?.map(t => t.name).join(', ') || 'none');
}

syncFunctions().catch(e => console.log('Error:', e.message));
