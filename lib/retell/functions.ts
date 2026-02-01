/**
 * Koya Caller - Retell Function Definitions
 * Session 13: Retell.ai Integration
 * Spec Reference: Part 11, Lines 1396-1450
 *
 * These functions are called by the Retell AI agent during calls.
 * They enable Koya to check availability, book appointments, transfer calls, etc.
 */

// =============================================================================
// Function Definitions for Retell Agent
// =============================================================================

/**
 * Function definitions to be registered with Retell LLM
 * Spec Reference: Part 11, Lines 1396-1450
 */
export const RETELL_FUNCTIONS = [
  {
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
  },
  {
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
  },
  {
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
  },
  {
    name: "transfer_call",
    description:
      "Transfer the call to the business owner. Use this when: " +
      "1) The caller specifically requests to speak with a person, " +
      "2) There's an emergency situation, " +
      "3) The caller is upset and needs human assistance, or " +
      "4) The question is beyond your knowledge. " +
      "Always explain to the caller that you're transferring them.",
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
  },
  {
    name: "take_message",
    description:
      "Take a message when you cannot directly help the caller. Use this when: " +
      "1) Transfer attempt failed (no answer), " +
      "2) It's after hours and booking isn't available, " +
      "3) The business has exhausted their minutes, or " +
      "4) The caller prefers to leave a message. " +
      "Always confirm the message back to the caller.",
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
          description:
            "Urgency level: low (general inquiry), normal (standard request), " +
            "high (time-sensitive), emergency (requires immediate attention)",
        },
      },
      required: ["caller_name", "caller_phone", "message", "urgency"],
    },
  },
  {
    name: "send_sms",
    description:
      "Send an SMS text message to the caller. Use this to: " +
      "1) Send booking confirmation details, " +
      "2) Send business information or directions, " +
      "3) Send links that can't be communicated verbally. " +
      "Always let the caller know you're sending a text.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The SMS message content (keep under 160 characters if possible)",
        },
        to_number: {
          type: "string",
          description:
            "Optional: Phone number to send to. Defaults to the caller's number.",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "end_call",
    description:
      "End the call politely. Use this when: " +
      "1) The caller's needs have been fully addressed, " +
      "2) The caller says goodbye or indicates they're done, " +
      "3) The caller requests to end the call. " +
      "Always thank the caller before ending.",
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
  },
  // ==========================================================================
  // Integration Functions - E-Commerce, CRM, Payments
  // ==========================================================================
  {
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
  },
  {
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
  },
  {
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
  },
  {
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
  },
  {
    name: "process_payment",
    description:
      "Collect a deposit or payment from the caller by sending an SMS payment link. " +
      "Use this to: 1) Collect deposits for appointments after booking, " +
      "2) Collect remaining balance for services, " +
      "3) Process one-time payments for products or services. " +
      "ONLY use this when the caller explicitly agrees to pay over the phone. " +
      "Never initiate payment without clear consent. " +
      "Examples: 'I'd like to pay the deposit now', 'Can I pay over the phone?', " +
      "'Let me pay for that', 'I want to put down a deposit'",
    parameters: {
      type: "object",
      properties: {
        amount_cents: {
          type: "number",
          description:
            "The payment amount in cents (e.g., 5000 for $50.00). " +
            "If not provided for deposits, uses business default deposit amount.",
        },
        payment_type: {
          type: "string",
          enum: ["deposit", "balance", "full"],
          description:
            "Type of payment: 'deposit' for appointment deposits, " +
            "'balance' for remaining balance after deposit, " +
            "'full' for full payment of service/product.",
        },
        appointment_id: {
          type: "string",
          description:
            "The appointment ID to associate this payment with. " +
            "Required for deposit and balance payment types. " +
            "Use the appointment ID from a recent booking.",
        },
        description: {
          type: "string",
          description:
            "What the payment is for (e.g., 'Deposit for haircut', 'Balance for consultation'). " +
            "Auto-generated if appointment_id is provided.",
        },
      },
      required: ["payment_type"],
    },
  },
];

// =============================================================================
// Default Greeting Templates
// =============================================================================

export const DEFAULT_GREETINGS = {
  english: {
    professional:
      "Thank you for calling {{business_name}}. This is {{ai_name}}, how may I assist you today?",
    friendly:
      "Hi there! Thanks for calling {{business_name}}. I'm {{ai_name}}, what can I do for you?",
    casual:
      "Hey! You've reached {{business_name}}. I'm {{ai_name}}. What's up?",
  },
  spanish: {
    professional:
      "Gracias por llamar a {{business_name}}. Soy {{ai_name}}, ¿en qué puedo ayudarle hoy?",
    friendly:
      "¡Hola! Gracias por llamar a {{business_name}}. Soy {{ai_name}}, ¿en qué te puedo ayudar?",
    casual:
      "¡Hola! Has llegado a {{business_name}}. Soy {{ai_name}}. ¿Qué necesitas?",
  },
  afterHours: {
    english:
      "Thank you for calling {{business_name}}. We're currently closed, but I can still help you. Would you like to leave a message or schedule an appointment?",
    spanish:
      "Gracias por llamar a {{business_name}}. Actualmente estamos cerrados, pero aún puedo ayudarte. ¿Te gustaría dejar un mensaje o programar una cita?",
  },
  minutesExhausted: {
    english:
      "Thank you for calling {{business_name}}. I can take a message for you and have someone call you back. What would you like me to tell them?",
    spanish:
      "Gracias por llamar a {{business_name}}. Puedo tomar un mensaje para usted y alguien le devolverá la llamada. ¿Qué le gustaría que les dijera?",
  },
};

// =============================================================================
// Backchannel Words for Natural Conversation
// =============================================================================

export const BACKCHANNEL_WORDS = {
  english: ["yeah", "uh-huh", "mhm", "I see", "right", "got it"],
  spanish: ["sí", "ajá", "vale", "entiendo", "claro", "ya veo"],
  bilingual: [
    "yeah",
    "uh-huh",
    "mhm",
    "I see",
    "ajá",
    "sí",
    "vale",
    "entiendo",
  ],
};

// =============================================================================
// Agent Personality Prompts
// =============================================================================

export const PERSONALITY_TRAITS = {
  professional: {
    tone: "formal, courteous, and business-appropriate",
    style:
      "Speak clearly and concisely. Use proper grammar. Address callers respectfully.",
    examples: [
      "Certainly, I'd be happy to help with that.",
      "Of course, let me check that for you.",
      "I understand. Allow me to look into this.",
    ],
  },
  friendly: {
    tone: "warm, approachable, and conversational",
    style:
      "Be personable and engaging. Show genuine interest. Use natural expressions.",
    examples: [
      "Sure thing! Let me help you with that.",
      "Absolutely! I can definitely do that for you.",
      "No problem at all! Let me take a look.",
    ],
  },
  casual: {
    tone: "relaxed, informal, and easy-going",
    style:
      "Be natural and laid-back. Use casual language. Keep things simple and direct.",
    examples: [
      "Yeah, totally! Let's get that sorted.",
      "For sure! Here's what I can do.",
      "Cool, let me check on that real quick.",
    ],
  },
};

// =============================================================================
// Language Detection Prompts
// =============================================================================

export const LANGUAGE_DETECTION = {
  auto: `
Listen for the caller's language in their first response. 
If they speak Spanish, respond in Spanish for the rest of the call.
If they speak English, respond in English for the rest of the call.
If unclear, default to English.
`,
  ask: `
After your initial greeting, ask: "Would you prefer to continue in English or Spanish? / ¿Prefiere continuar en inglés o español?"
Then continue in whichever language they choose.
`,
  spanish_default: `
Speak Spanish by default. If the caller responds in English, switch to English.
`,
};

// =============================================================================
// System Prompt Template
// =============================================================================

export function buildSystemPromptTemplate(options: {
  businessName: string;
  aiName: string;
  personality: "professional" | "friendly" | "casual";
  spanishEnabled: boolean;
  languageMode: "auto" | "ask" | "spanish_default";
  services: string[];
  faqs: { question: string; answer: string }[];
  businessHours: string;
  canBook: boolean;
  canTransfer: boolean;
}): string {
  const personalityTraits = PERSONALITY_TRAITS[options.personality];
  const languageInstruction = options.spanishEnabled
    ? LANGUAGE_DETECTION[options.languageMode]
    : "";

  return `You are ${options.aiName}, the AI receptionist for ${options.businessName}.

## Your Personality
- Tone: ${personalityTraits.tone}
- Style: ${personalityTraits.style}
- Example phrases: ${personalityTraits.examples.join(" | ")}

## Language
${options.spanishEnabled ? languageInstruction : "Speak English only."}

## Business Hours
${options.businessHours}

## Available Services
${options.services.map((s) => `- ${s}`).join("\n")}

## Frequently Asked Questions
${options.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")}

## Your Capabilities
${options.canBook ? "- You can check availability and book appointments using the check_availability and book_appointment functions." : "- Appointment booking is not available right now."}
${options.canTransfer ? "- You can transfer calls to the business owner using the transfer_call function." : "- Call transfers are not available right now."}
- You can take messages using the take_message function.
- You can send SMS confirmations using the send_sms function.
- You can politely end calls using the end_call function.

## Important Rules
1. Always be helpful and courteous
2. Never make up information - if you don't know, offer to take a message
3. Confirm important details (dates, times, phone numbers) by repeating them back
4. If a caller seems upset, acknowledge their feelings and offer to transfer to a human
5. Keep responses concise - this is a phone call, not an email
6. If asked about pricing, provide the information if available, otherwise offer to have someone call back

## Dynamic Context
Business name: {{business_name}}
Your name: {{ai_name}}
Minutes exhausted: {{minutes_exhausted}}
After hours mode: {{after_hours}}
Can book appointments: {{can_book}}
Transfer enabled: {{transfer_enabled}}
Today's date: {{today_date}}
Current time: {{current_time}}
`;
}

// =============================================================================
// Helper to prepare dynamic variables for a call
// =============================================================================

export function prepareDynamicVariables(options: {
  businessName: string;
  aiName: string;
  minutesExhausted?: boolean;
  afterHours?: boolean;
  canBook?: boolean;
  transferEnabled?: boolean;
  transferNumber?: string;
  spanishEnabled?: boolean;
  languageMode?: string;
  services?: { name: string; duration_minutes: number }[];
  faqs?: { question: string; answer: string }[];
  businessHours?: string;
  // External booking page
  bookingPageUrl?: string;
  // Outbound call specific
  isOutbound?: boolean;
  outboundPurpose?: "reminder" | "followup" | "custom";
  customMessage?: string;
  [key: string]: unknown;
}): Record<string, string> {
  const now = new Date();

  const baseVars: Record<string, string> = {
    business_name: options.businessName,
    ai_name: options.aiName,
    minutes_exhausted: options.minutesExhausted ? "true" : "false",
    after_hours: options.afterHours ? "true" : "false",
    can_book: options.canBook !== false ? "true" : "false",
    transfer_enabled: options.transferEnabled ? "true" : "false",
    transfer_number: options.transferNumber || "",
    spanish_enabled: options.spanishEnabled ? "true" : "false",
    language_mode: options.languageMode || "auto",
    current_services: JSON.stringify(
      (options.services || []).map((s) => s.name)
    ),
    current_faqs: JSON.stringify(
      (options.faqs || []).slice(0, 5).map((f) => ({
        q: f.question,
        a: f.answer,
      }))
    ),
    business_hours: options.businessHours || "",
    booking_page_url: options.bookingPageUrl || "",
    today_date: now.toISOString().split("T")[0],
    current_time: now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  };

  // Add outbound-specific variables if this is an outbound call
  if (options.isOutbound) {
    baseVars.is_outbound = "true";
    baseVars.outbound_purpose = options.outboundPurpose || "custom";

    // Store custom instructions separately - these are BEHAVIORAL instructions, not spoken
    if (options.customMessage) {
      baseVars.outbound_instructions = options.customMessage;
    }

    // Build the greeting for begin_message dynamic variable
    // Note: The greeting is what the AI SAYS, NOT the instructions
    const name = options.aiName || "Koya";
    const biz = options.businessName || "our office";
    const purpose = options.outboundPurpose || "custom";
    if (purpose === "reminder") {
      baseVars.greeting = `Hi, this is ${name} calling from ${biz}. I'm calling to remind you about your upcoming appointment.`;
    } else if (purpose === "followup") {
      baseVars.greeting = `Hi, this is ${name} calling from ${biz}. I'm following up with you regarding your recent visit.`;
    } else {
      // For custom purpose, use a generic greeting - the instructions guide behavior, not speech
      baseVars.greeting = `Hi, this is ${name} calling from ${biz}. How are you doing today?`;
    }
  } else {
    // Inbound greeting
    const name = options.aiName || "Koya";
    const biz = options.businessName || "our office";
    baseVars.greeting = `Thanks for calling ${biz}, this is ${name}, how can I help you today?`;
  }

  // Add any additional custom variables
  const knownKeys = [
    "businessName", "aiName", "minutesExhausted", "afterHours", "canBook",
    "transferEnabled", "transferNumber", "spanishEnabled", "languageMode", "services", "faqs",
    "businessHours", "bookingPageUrl", "isOutbound", "outboundPurpose", "customMessage"
  ];

  for (const [key, value] of Object.entries(options)) {
    if (!knownKeys.includes(key) && typeof value === "string") {
      baseVars[key] = value;
    }
  }

  return baseVars;
}
