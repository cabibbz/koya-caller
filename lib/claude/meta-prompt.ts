/**
 * Koya Caller - Meta-Prompt for Voice AI System Prompts
 * Session 14: Claude API Integration
 * Spec Reference: Part 15, Lines 1760-1792
 *
 * This meta-prompt instructs Claude how to generate system prompts
 * for Retell voice AI agents.
 */

import type { PromptGenerationInput, EnhancedPromptConfig } from "./types";
import { generateIndustryContextSection } from "./industry-prompts";
import { generateSentimentInstructions } from "./sentiment-responses";
import { generateErrorHandlingInstructions } from "./error-templates";
import { getRelevantExamples, formatExamplesForPrompt } from "./few-shot-examples";
import type { Personality } from "./error-templates";
import type { IndustryType } from "./industry-prompts";

// =============================================================================
// Meta-Prompt Template
// Spec Reference: Lines 1760-1792
// =============================================================================

/**
 * The meta-prompt that instructs Claude how to write voice AI prompts.
 * This is the "prompt for writing prompts".
 */
export const VOICE_AI_META_PROMPT = `You are an expert prompt engineer creating system prompts for voice AI agents.

Your task is to generate a highly effective system prompt for a voice AI receptionist. The prompt you create will be used by a Retell.ai voice agent to handle real phone calls for a business.

<business_context>
Business Name: {BUSINESS_NAME}
Industry: {INDUSTRY}
Services: {SERVICES}
AI Assistant Name: {AI_NAME}
Personality: {PERSONALITY}
Language: {LANGUAGE}
</business_context>

<output_structure>
Generate the prompt with these exact sections:

1. # Personality
   Write 2-3 sentences defining who the AI is and their core traits.

2. # Environment
   Describe the context of interactions (phone calls, what callers expect).

3. # Goal
   Numbered workflow steps for handling calls. Mark critical steps with "This step is important."

4. # Guardrails
   Non-negotiable rules the AI must follow.

5. # Frequently Asked Questions
   IMPORTANT: Include ALL FAQs from the additional_context VERBATIM in Q&A format.
   The AI should use these exact answers when callers ask these questions.
   Format each as:
   Q: [exact question]
   A: [exact answer]

6. # Tools
   When and how to use each function (check_availability, book_appointment, transfer_call, take_message, send_sms, end_call).
   Include error handling guidance.

7. # Character Normalization
   Rules for converting spoken words to written format (emails, phone numbers, dates).
</output_structure>

<constraints>
- Keep total prompt under 2500 tokens (longer prompts OK if needed for FAQs)
- Use action-oriented language
- Mark critical instructions with "This step is important."
- Design for voice: responses should be 2-3 sentences max
- Include natural filler words and acknowledgments appropriate to the personality
- Never generate placeholder text - use actual business details
</constraints>

<function_definitions>
The AI has access to these functions:
- check_availability(date, service?) - Check available appointment times
- book_appointment(date, time, customer_name, customer_phone, service, notes?) - Book an appointment
- transfer_call(reason) - Transfer to business owner
- take_message(caller_name, caller_phone, message, urgency) - Take a message
- send_sms(message, to_number?) - Send SMS to caller
- end_call(reason) - End the call politely
</function_definitions>

<additional_context>
{ADDITIONAL_CONTEXT}
</additional_context>

Generate only the system prompt content. Do not include any preamble or explanation.`;

// =============================================================================
// Context Builders
// =============================================================================

/**
 * Format business hours for the prompt
 */
function formatBusinessHours(hours: PromptGenerationInput["business"]["hours"]): string {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
  const formattedDays: string[] = [];

  for (const day of days) {
    const dayHours = hours[day];
    if (dayHours) {
      formattedDays.push(`${day.charAt(0).toUpperCase() + day.slice(1)}: ${dayHours.open} - ${dayHours.close}`);
    } else {
      formattedDays.push(`${day.charAt(0).toUpperCase() + day.slice(1)}: Closed`);
    }
  }

  return formattedDays.join("\n");
}

/**
 * Format services list for the prompt
 */
function formatServices(services: PromptGenerationInput["services"]): string {
  if (services.length === 0) return "No specific services listed";

  return services
    .map((s) => {
      let line = `- ${s.name}`;
      if (s.duration_minutes) line += ` (${s.duration_minutes} min)`;
      if (s.price) line += ` - $${s.price}`;
      if (s.description) line += `: ${s.description}`;
      return line;
    })
    .join("\n");
}

/**
 * Format FAQs for the prompt
 */
function formatFAQs(faqs: PromptGenerationInput["faqs"]): string {
  if (faqs.length === 0) return "No FAQs provided";

  return faqs
    .slice(0, 10) // Limit to 10 FAQs to stay within token limits
    .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
    .join("\n\n");
}

/**
 * Build additional context section
 */
function buildAdditionalContext(input: PromptGenerationInput): string {
  const sections: string[] = [];

  // Business details
  if (input.business.serviceArea) {
    sections.push(`Service Area: ${input.business.serviceArea}`);
  }
  if (input.business.differentiator) {
    sections.push(`What makes this business special: ${input.business.differentiator}`);
  }
  if (input.business.website) {
    sections.push(`Website: ${input.business.website}`);
  }

  // Business hours
  sections.push(`\nBusiness Hours:\n${formatBusinessHours(input.business.hours)}`);
  sections.push(`Timezone: ${input.business.hours.timezone}`);

  // Services
  sections.push(`\nServices Offered:\n${formatServices(input.services)}`);

  // FAQs
  if (input.faqs.length > 0) {
    sections.push(`\nFrequently Asked Questions:\n${formatFAQs(input.faqs)}`);
  }

  // Upsells
  if (input.upsells && input.upsells.length > 0) {
    const regularUpsells = input.upsells.filter(u => !u.suggestWhenUnavailable);
    const availabilityUpsells = input.upsells.filter(u => u.suggestWhenUnavailable);

    if (regularUpsells.length > 0) {
      const upsellsText = regularUpsells.map((u) => {
        let text = `- When customer wants "${u.sourceServiceName}", suggest upgrading to "${u.targetServiceName}"`;
        if (u.discountPercent > 0) {
          text += ` (${u.discountPercent}% off the upgrade)`;
        }
        if (u.pitchMessage) {
          text += `\n  Pitch: "${u.pitchMessage}"`;
        }
        text += `\n  Timing: ${u.triggerTiming === "before_booking" ? "Suggest before confirming the booking" : "Mention after booking is confirmed"}`;
        return text;
      }).join("\n");
      sections.push(`\nUpsell Opportunities:\n${upsellsText}\n\nGuidelines for upselling:
- Only suggest upsells when naturally relevant to the conversation
- Don't be pushy - accept "no" gracefully and proceed with original booking
- Frame upgrades as added value, not a sales pitch
- If customer declines, do NOT mention the upsell again in the same call`);
    }

    if (availabilityUpsells.length > 0) {
      const availText = availabilityUpsells.map(u => {
        let text = `- When "${u.sourceServiceName}" is unavailable, suggest "${u.targetServiceName}" instead`;
        if (u.discountPercent > 0) text += ` (${u.discountPercent}% off)`;
        if (u.pitchMessage) text += `\n  Pitch: "${u.pitchMessage}"`;
        return text;
      }).join("\n");
      sections.push(`\nAvailability-Based Alternatives:\n${availText}\n\nWhen the requested time slot is unavailable, check if an alternative service might work for the customer.`);
    }
  }

  // Bundles
  if (input.bundles && input.bundles.length > 0) {
    const bundlesText = input.bundles.map((b) => {
      let text = `- "${b.name}" bundle: ${b.serviceNames.join(" + ")}`;
      if (b.discountPercent > 0) {
        text += ` (${b.discountPercent}% off when booked together)`;
      }
      if (b.pitchMessage) {
        text += `\n  Pitch: "${b.pitchMessage}"`;
      }
      return text;
    }).join("\n");
    sections.push(`\nBundle Deals:\n${bundlesText}\n\nGuidelines for bundles:
- When a customer books a service that's part of a bundle, mention the bundle deal
- Calculate and state the savings clearly
- Don't force bundles - accept if they only want one service`);
  }

  // Packages
  if (input.packages && input.packages.length > 0) {
    const packagesText = input.packages.map((p) => {
      let text = `- "${p.name}": ${p.sessionCount} sessions`;
      if (p.serviceName) {
        text += ` of ${p.serviceName}`;
      }
      if (p.discountPercent > 0) {
        text += ` at ${p.discountPercent}% off`;
      }
      if (p.pitchMessage) {
        text += `\n  Pitch: "${p.pitchMessage}"`;
      }
      if (p.minVisitsToPitch > 0) {
        text += `\n  Only mention to callers with ${p.minVisitsToPitch}+ previous visits`;
      }
      return text;
    }).join("\n");
    sections.push(`\nMulti-Visit Packages:\n${packagesText}\n\nGuidelines for packages:
- Pitch packages when appropriate based on visit count threshold
- Emphasize long-term value and convenience
- Calculate per-session savings when explaining`);
  }

  // Memberships
  if (input.memberships && input.memberships.length > 0) {
    const membershipsText = input.memberships.map((m) => {
      let text = `- "${m.name}": $${m.pricePerMonth}/month`;
      if (m.billingPeriod !== "monthly") {
        text += ` (billed ${m.billingPeriod})`;
      }
      text += `\n  Benefits: ${m.benefits}`;
      if (m.pitchMessage) {
        text += `\n  Pitch: "${m.pitchMessage}"`;
      }
      return text;
    }).join("\n");
    sections.push(`\nMembership Plans:\n${membershipsText}\n\nGuidelines for memberships:
- Mention membership benefits when relevant
- Pitch after larger bookings or to repeat callers
- Don't pressure - just inform about the option`);
  }

  // Additional knowledge
  if (input.additionalKnowledge) {
    sections.push(`\nAdditional Business Information:\n${input.additionalKnowledge}`);
  }

  // Things to never say
  if (input.neverSay) {
    sections.push(`\nNever say or discuss:\n${input.neverSay}`);
  }

  // Custom greeting
  sections.push(`\nCustom Greeting: "${input.aiConfig.greeting}"`);

  // Call handling capabilities
  const capabilities: string[] = [];
  if (input.bookingSettings.enabled) {
    capabilities.push("Can book appointments");
    if (input.bookingSettings.requireConfirmation) {
      capabilities.push("Appointments require confirmation");
    }
    capabilities.push(`Can book up to ${input.bookingSettings.maxAdvanceDays} days in advance`);
  } else {
    capabilities.push("Appointment booking is NOT available - take messages instead");
  }

  if (input.callSettings.transferEnabled && input.callSettings.transferNumber) {
    capabilities.push("Can transfer calls to owner");
    if (input.callSettings.transferOnRequest) capabilities.push("Transfer when caller requests");
    if (input.callSettings.transferOnEmergency) capabilities.push("Transfer for emergencies");
    if (input.callSettings.transferOnUpset) capabilities.push("Transfer if caller is upset");
  } else {
    capabilities.push("Call transfer is NOT available - take messages for urgent matters");
  }

  sections.push(`\nCapabilities:\n${capabilities.map((c) => `- ${c}`).join("\n")}`);

  // After hours behavior
  if (input.callSettings.afterHoursEnabled) {
    sections.push(`\nAfter Hours: The AI handles after-hours calls.`);
    if (input.callSettings.afterHoursCanBook) {
      sections.push("Can still book appointments after hours.");
    } else {
      sections.push("Cannot book appointments after hours - take messages only.");
    }
  }

  // Minutes exhausted mode
  if (input.isMinutesExhausted) {
    sections.push(`\n⚠️ IMPORTANT: The business has exhausted their monthly minutes. 
The AI should ONLY take messages. Do not attempt to book appointments or have extended conversations.
Keep interactions brief and focus on capturing: caller name, phone number, and their message.`);
  } else {
    sections.push(`\nMinutes remaining: ${input.planMinutesRemaining}`);
  }

  return sections.join("\n");
}

// =============================================================================
// Prompt Generation Functions
// =============================================================================

/**
 * Build the complete prompt for Claude to generate an English system prompt
 */
export function buildEnglishPromptRequest(input: PromptGenerationInput): string {
  const personalityDescriptions = {
    professional: "formal, courteous, and business-appropriate",
    friendly: "warm, approachable, and conversational",
    casual: "relaxed, informal, and easy-going",
  };

  return VOICE_AI_META_PROMPT
    .replace("{BUSINESS_NAME}", input.business.name)
    .replace("{INDUSTRY}", input.business.type)
    .replace("{SERVICES}", input.services.map((s) => s.name).join(", ") || "General services")
    .replace("{AI_NAME}", input.aiConfig.name)
    .replace("{PERSONALITY}", personalityDescriptions[input.aiConfig.personality])
    .replace("{LANGUAGE}", "English")
    .replace("{ADDITIONAL_CONTEXT}", buildAdditionalContext(input));
}

/**
 * Build the complete prompt for Claude to generate a Spanish system prompt
 * Spec Reference: Lines 1822-1842
 */
export function buildSpanishPromptRequest(input: PromptGenerationInput): string {
  const personalityDescriptions = {
    professional: "formal, cortés y apropiado para negocios (use 'usted')",
    friendly: "cálido, accesible y conversacional",
    casual: "relajado, informal y tranquilo",
  };

  // Create Spanish-specific context
  const spanishContext = buildAdditionalContext(input);
  
  // Add Spanish-specific instructions
  const spanishAdditions = `

Spanish-Specific Guidelines:
- Use "usted" form for professional tone, "tú" for casual
- Localized for US Hispanic market
- Natural Spanish expressions and idioms
- ${input.aiConfig.greetingSpanish ? `Custom Spanish greeting: "${input.aiConfig.greetingSpanish}"` : "Translate the English greeting naturally"}`;

  return VOICE_AI_META_PROMPT
    .replace("{BUSINESS_NAME}", input.business.name)
    .replace("{INDUSTRY}", input.business.type)
    .replace("{SERVICES}", input.services.map((s) => s.name).join(", ") || "Servicios generales")
    .replace("{AI_NAME}", input.aiConfig.name)
    .replace("{PERSONALITY}", personalityDescriptions[input.aiConfig.personality])
    .replace("{LANGUAGE}", "Spanish (US Hispanic market, use 'usted' formality for professional tone)")
    .replace("{ADDITIONAL_CONTEXT}", spanishContext + spanishAdditions);
}

/**
 * Build language detection/switching instructions
 * Added to prompts when language mode is "auto" or "ask"
 */
export function buildLanguageSwitchingInstructions(mode: "auto" | "ask" | "spanish_default"): string {
  switch (mode) {
    case "auto":
      return `
# Language Detection
Listen for the caller's language in their first response.
- If they speak Spanish, respond in Spanish for the rest of the call.
- If they speak English, respond in English for the rest of the call.
- If unclear, default to English.
This step is important.`;

    case "ask":
      return `
# Language Selection
After your initial greeting, ask: "Would you prefer to continue in English or Spanish? / ¿Prefiere continuar en inglés o español?"
Then continue in whichever language they choose.
This step is important.`;

    case "spanish_default":
      return `
# Language
Speak Spanish by default. If the caller responds in English, switch to English.
This step is important.`;
  }
}

// =============================================================================
// Mock Prompt Generator (for development without API key)
// =============================================================================

/**
 * Generate a mock English prompt for development/testing
 */
export function generateMockEnglishPrompt(input: PromptGenerationInput): string {
  const personality = input.aiConfig.personality;
  const traits = {
    professional: {
      tone: "formal, courteous, and business-appropriate",
      examples: '"Certainly, I\'d be happy to help." | "Of course, let me check that for you."',
    },
    friendly: {
      tone: "warm, approachable, and conversational",
      examples: '"Sure thing! Let me help you with that." | "Absolutely! I can do that for you."',
    },
    casual: {
      tone: "relaxed, informal, and easy-going",
      examples: '"Yeah, totally! Let\'s get that sorted." | "Cool, let me check on that."',
    },
  };

  return `# Personality
You are ${input.aiConfig.name}, the AI receptionist for ${input.business.name}. You are ${traits[personality].tone}. You handle phone calls professionally while making callers feel welcome and heard.

# Environment
You are answering phone calls for ${input.business.name}, a ${input.business.type} business${input.business.serviceArea ? ` serving ${input.business.serviceArea}` : ""}. Callers expect quick, helpful service and may want to book appointments, ask questions, or speak with someone.

# Tone
- Keep responses to 2-3 sentences unless more detail is requested
- Use conversational language, avoid jargon
- Confirm understanding after complex information
- Example phrases: ${traits[personality].examples}

# Goal
1. Greet the caller warmly using your custom greeting. This step is important.
2. Listen to identify their need (booking, inquiry, or other)
3. For bookings: collect name, preferred date/time, service type
4. Check availability before confirming any appointment
5. Confirm all details before finalizing. This step is important.
6. Thank them and ask if there's anything else

# Guardrails
- Never make up availability—always use check_availability first
- If unsure about something, say "Let me check on that" rather than guessing
- Acknowledge frustration before problem-solving
- Never discuss competitor businesses
- Keep personal opinions out of conversations
${input.neverSay ? `- Never mention: ${input.neverSay}` : ""}

# Tools
Use these functions during calls:
- check_availability: ALWAYS call this before suggesting appointment times
- book_appointment: Only after confirming all details with the caller
- transfer_call: When caller requests human, emergencies, or complex issues
- take_message: When transfer fails, after hours, or caller prefers
- send_sms: To send confirmations or information that's hard to communicate verbally
- end_call: After caller's needs are met and they're ready to hang up

Error Handling:
- If a function fails, apologize briefly and offer an alternative
- "I'm having trouble checking that right now. Would you like me to take a message instead?"

# Character Normalization
Convert spoken words to proper format:
- Email: "john at company dot com" → "john@company.com"
- Phone: "five five five, one two three, four five six seven" → "555-123-4567"
- Dates: "next Tuesday" → use actual date
- Times: "two thirty pm" → "2:30 PM"

# Dynamic Context (Updated Each Call)
Business: {{business_name}}
Your name: {{ai_name}}
Today: {{current_date}}
Time: {{current_time}}
Today's Hours: {{todays_hours}}
After hours: {{is_after_hours}}

# Live Knowledge Base
Use this information to answer caller questions. This is always current:

## Services Available
{{services_list}}

## Frequently Asked Questions
{{faqs}}

## Additional Business Info
{{additional_knowledge}}`;
}

/**
 * Generate a mock Spanish prompt for development/testing
 */
export function generateMockSpanishPrompt(input: PromptGenerationInput): string {
  const personality = input.aiConfig.personality;
  const traits = {
    professional: {
      tone: "formal, cortés y profesional",
      formality: "usted",
      examples: '"Por supuesto, con mucho gusto le ayudo." | "Permítame verificar eso por usted."',
    },
    friendly: {
      tone: "cálido, accesible y conversacional",
      formality: "usted/tú",
      examples: '"¡Claro que sí! Déjame ayudarte con eso." | "¡Por supuesto! Puedo hacer eso."',
    },
    casual: {
      tone: "relajado, informal y tranquilo",
      formality: "tú",
      examples: '"¡Sí, claro! Vamos a arreglar eso." | "Dale, déjame revisar."',
    },
  };

  return `# Personalidad
Eres ${input.aiConfig.name}, el recepcionista virtual de ${input.business.name}. Eres ${traits[personality].tone}. Manejas las llamadas telefónicas profesionalmente mientras haces que los clientes se sientan bienvenidos.

# Ambiente
Estás contestando llamadas para ${input.business.name}, un negocio de ${input.business.type}${input.business.serviceArea ? ` que sirve a ${input.business.serviceArea}` : ""}. Los clientes esperan un servicio rápido y útil.

# Tono
- Mantén las respuestas en 2-3 oraciones a menos que se pida más detalle
- Usa lenguaje conversacional, evita jerga técnica
- Confirma la comprensión después de información compleja
- Usa "${traits[personality].formality}" según el tono
- Frases ejemplo: ${traits[personality].examples}

# Objetivo
1. Saluda al cliente calurosamente. Este paso es importante.
2. Escucha para identificar su necesidad (cita, consulta, u otro)
3. Para citas: obtén nombre, fecha/hora preferida, tipo de servicio
4. Verifica disponibilidad antes de confirmar cualquier cita
5. Confirma todos los detalles antes de finalizar. Este paso es importante.
6. Agradece y pregunta si hay algo más en que puedas ayudar

# Reglas Importantes
- Nunca inventes disponibilidad—siempre usa check_availability primero
- Si no estás seguro, di "Déjeme verificar eso" en lugar de adivinar
- Reconoce la frustración antes de resolver problemas
- Nunca discutas negocios de la competencia
${input.neverSay ? `- Nunca menciones: ${input.neverSay}` : ""}

# Herramientas
Usa estas funciones durante las llamadas:
- check_availability: SIEMPRE llámala antes de sugerir horarios
- book_appointment: Solo después de confirmar todos los detalles
- transfer_call: Cuando el cliente pide hablar con una persona, emergencias, o temas complejos
- take_message: Cuando la transferencia falla, fuera de horario, o el cliente prefiere
- send_sms: Para enviar confirmaciones o información difícil de comunicar verbalmente
- end_call: Después de que las necesidades del cliente están satisfechas

Manejo de Errores:
- Si una función falla, discúlpate brevemente y ofrece una alternativa
- "Tengo problemas para verificar eso ahora. ¿Le gustaría dejar un mensaje?"

# Normalización de Caracteres
Convierte palabras habladas al formato correcto:
- Email: "juan arroba empresa punto com" → "juan@empresa.com"
- Teléfono: "cinco cinco cinco, uno dos tres" → "555-123"
- Fechas: "el próximo martes" → usa la fecha real
- Horas: "dos y media de la tarde" → "2:30 PM"

# Contexto Dinámico
Negocio: {{business_name}}
Tu nombre: {{ai_name}}
Hoy: {{current_date}}
Hora: {{current_time}}
Horario de hoy: {{todays_hours}}
Fuera de horario: {{is_after_hours}}

# Base de Conocimiento en Vivo
Usa esta información para responder preguntas. Siempre está actualizada:

## Servicios Disponibles
{{services_list}}

## Preguntas Frecuentes
{{faqs}}

## Información Adicional del Negocio
{{additional_knowledge}}`;
}

// =============================================================================
// Enhanced Prompt Generation with Injections
// =============================================================================

/**
 * Enhanced meta-prompt template with injection points
 */
export const ENHANCED_VOICE_AI_META_PROMPT = `You are an expert prompt engineer creating system prompts for voice AI agents.

Your task is to generate a highly effective system prompt for a voice AI receptionist. The prompt you create will be used by a Retell.ai voice agent to handle real phone calls for a business.

<business_context>
Business Name: {BUSINESS_NAME}
Industry: {INDUSTRY}
Services: {SERVICES}
AI Assistant Name: {AI_NAME}
Personality: {PERSONALITY}
Language: {LANGUAGE}
</business_context>

{INDUSTRY_CONTEXT}

{SENTIMENT_INSTRUCTIONS}

{FEW_SHOT_EXAMPLES}

{ERROR_HANDLING}

<output_structure>
Generate the prompt with these exact sections:

1. # Personality
   Write 2-3 sentences defining who the AI is and their core traits.
   Incorporate the industry-specific personality guidance provided above.

2. # Environment
   Describe the context of interactions (phone calls, what callers expect).
   Include industry-specific terminology and scenarios.

3. # Tone
   Specific voice and speech guidelines based on the personality type.
   Apply the tone intensity setting: {TONE_INTENSITY}/5 (1=subdued, 5=expressive)

4. # Goal
   Numbered workflow steps for handling calls. Mark critical steps with "This step is important."
   Include handling for repeat callers and urgent situations.

5. # Guardrails
   Non-negotiable rules the AI must follow.
   Include industry-specific guardrails.

6. # Sentiment Awareness
   How to detect and respond to caller emotions.
   Include de-escalation techniques.

7. # Tools
   When and how to use each function (check_availability, book_appointment, transfer_call, take_message, send_sms, end_call).
   Include personality-aware error handling guidance.

8. # Character Normalization
   Rules for converting spoken words to written format (emails, phone numbers, dates).
</output_structure>

<constraints>
- Keep total prompt under 2000 tokens
- Use action-oriented language
- Mark critical instructions with "This step is important."
- Design for voice: responses should be 2-3 sentences max
- Include natural filler words and acknowledgments appropriate to the personality
- Never generate placeholder text - use actual business details
- Apply personality consistently in all examples and guidance
</constraints>

<function_definitions>
The AI has access to these functions:
- check_availability(date, service?) - Check available appointment times
- book_appointment(date, time, customer_name, customer_phone, service, notes?) - Book an appointment
- transfer_call(reason) - Transfer to business owner
- take_message(caller_name, caller_phone, message, urgency) - Take a message
- send_sms(message, to_number?) - Send SMS to caller
- end_call(reason) - End the call politely
</function_definitions>

<additional_context>
{ADDITIONAL_CONTEXT}
</additional_context>

{CALLER_CONTEXT}

Generate only the system prompt content. Do not include any preamble or explanation.`;

/**
 * Build enhanced industry context section
 */
function buildIndustryContextSection(
  businessType: string,
  personality: Personality,
  language: "en" | "es"
): string {
  return generateIndustryContextSection(businessType, personality, language);
}

/**
 * Build sentiment instructions section
 */
function buildSentimentSection(
  personality: Personality,
  level: "none" | "basic" | "advanced",
  language: "en" | "es"
): string {
  if (level === "none") return "";
  return generateSentimentInstructions(personality, language);
}

/**
 * Build few-shot examples section
 */
function buildFewShotSection(
  personality: Personality,
  businessType: string,
  maxExamples: number,
  language: "en" | "es"
): string {
  const examples = getRelevantExamples(
    personality,
    businessType as IndustryType,
    language,
    maxExamples
  );
  return formatExamplesForPrompt(examples, language);
}

/**
 * Build error handling section
 */
function buildErrorHandlingSection(
  personality: Personality,
  language: "en" | "es"
): string {
  return generateErrorHandlingInstructions(personality, language);
}

/**
 * Build caller context section for the meta-prompt
 */
function buildCallerContextSection(enabled: boolean, language: "en" | "es"): string {
  if (!enabled) return "";

  if (language === "es") {
    return `
<caller_context_handling>
## Manejo de Contexto del Llamante

El sistema proporcionara contexto sobre el llamante si esta disponible:
- {{is_repeat_caller}} - "true" si han llamado antes
- {{caller_name}} - Su nombre si se conoce
- {{previous_call_count}} - Cuantas veces han llamado
- {{last_service}} - Ultimo servicio reservado

Para llamantes recurrentes:
- Reconocelos: "Que gusto escucharle de nuevo!"
- Referencia su historial si es relevante
- Omite preguntas redundantes si ya tienes su informacion
- Usa su nombre cuando sea apropiado

Para llamantes nuevos:
- Hazlos sentir bienvenidos
- Captura su informacion de contacto
- Explica los servicios si preguntan
</caller_context_handling>`;
  }

  return `
<caller_context_handling>
## Caller Context Handling

The system will provide context about the caller if available:
- {{is_repeat_caller}} - "true" if they've called before
- {{caller_name}} - Their name if known
- {{previous_call_count}} - How many times they've called
- {{last_service}} - Last service they booked

For repeat callers:
- Acknowledge them: "Good to hear from you again!"
- Reference their history if relevant
- Skip redundant questions if you already have their info
- Use their name when appropriate

For new callers:
- Make a great first impression
- Capture their contact information
- Explain services if they ask
</caller_context_handling>`;
}

/**
 * Build enhanced English prompt request with all enhancements
 */
export function buildEnhancedEnglishPromptRequest(
  input: PromptGenerationInput,
  config?: EnhancedPromptConfig
): string {
  const enhancedConfig = config || {
    industryEnhancements: true,
    fewShotExamplesEnabled: true,
    sentimentDetectionLevel: "basic" as const,
    callerContextEnabled: true,
    toneIntensity: 3 as const,
    personalityAwareErrors: true,
    maxFewShotExamples: 3
  };

  const personality = input.aiConfig.personality as Personality;
  const businessType = input.business.type;

  const personalityDescriptions = {
    professional: "formal, courteous, and business-appropriate",
    friendly: "warm, approachable, and conversational",
    casual: "relaxed, informal, and easy-going",
  };

  // Build enhanced sections
  const industryContext = enhancedConfig.industryEnhancements
    ? buildIndustryContextSection(businessType, personality, "en")
    : "";

  const sentimentInstructions = buildSentimentSection(
    personality,
    enhancedConfig.sentimentDetectionLevel,
    "en"
  );

  const fewShotExamples = enhancedConfig.fewShotExamplesEnabled
    ? buildFewShotSection(personality, businessType, enhancedConfig.maxFewShotExamples, "en")
    : "";

  const errorHandling = enhancedConfig.personalityAwareErrors
    ? buildErrorHandlingSection(personality, "en")
    : "";

  const callerContext = buildCallerContextSection(enhancedConfig.callerContextEnabled, "en");

  return ENHANCED_VOICE_AI_META_PROMPT
    .replace("{BUSINESS_NAME}", input.business.name)
    .replace("{INDUSTRY}", businessType)
    .replace("{SERVICES}", input.services.map((s) => s.name).join(", ") || "General services")
    .replace("{AI_NAME}", input.aiConfig.name)
    .replace("{PERSONALITY}", personalityDescriptions[personality])
    .replace("{LANGUAGE}", "English")
    .replace("{TONE_INTENSITY}", enhancedConfig.toneIntensity.toString())
    .replace("{INDUSTRY_CONTEXT}", industryContext)
    .replace("{SENTIMENT_INSTRUCTIONS}", sentimentInstructions)
    .replace("{FEW_SHOT_EXAMPLES}", fewShotExamples)
    .replace("{ERROR_HANDLING}", errorHandling)
    .replace("{CALLER_CONTEXT}", callerContext)
    .replace("{ADDITIONAL_CONTEXT}", buildAdditionalContext(input));
}

/**
 * Build enhanced Spanish prompt request with all enhancements
 */
export function buildEnhancedSpanishPromptRequest(
  input: PromptGenerationInput,
  config?: EnhancedPromptConfig
): string {
  const enhancedConfig = config || {
    industryEnhancements: true,
    fewShotExamplesEnabled: true,
    sentimentDetectionLevel: "basic" as const,
    callerContextEnabled: true,
    toneIntensity: 3 as const,
    personalityAwareErrors: true,
    maxFewShotExamples: 3
  };

  const personality = input.aiConfig.personality as Personality;
  const businessType = input.business.type;

  const personalityDescriptions = {
    professional: "formal, cortés y apropiado para negocios (use 'usted')",
    friendly: "cálido, accesible y conversacional",
    casual: "relajado, informal y tranquilo",
  };

  // Build enhanced sections in Spanish
  const industryContext = enhancedConfig.industryEnhancements
    ? buildIndustryContextSection(businessType, personality, "es")
    : "";

  const sentimentInstructions = buildSentimentSection(
    personality,
    enhancedConfig.sentimentDetectionLevel,
    "es"
  );

  const fewShotExamples = enhancedConfig.fewShotExamplesEnabled
    ? buildFewShotSection(personality, businessType, enhancedConfig.maxFewShotExamples, "es")
    : "";

  const errorHandling = enhancedConfig.personalityAwareErrors
    ? buildErrorHandlingSection(personality, "es")
    : "";

  const callerContext = buildCallerContextSection(enhancedConfig.callerContextEnabled, "es");

  // Create Spanish-specific context
  const spanishContext = buildAdditionalContext(input);

  // Add Spanish-specific instructions
  const spanishAdditions = `

Spanish-Specific Guidelines:
- Use "usted" form for professional tone, "tú" for casual
- Localized for US Hispanic market
- Natural Spanish expressions and idioms
- ${input.aiConfig.greetingSpanish ? `Custom Spanish greeting: "${input.aiConfig.greetingSpanish}"` : "Translate the English greeting naturally"}`;

  return ENHANCED_VOICE_AI_META_PROMPT
    .replace("{BUSINESS_NAME}", input.business.name)
    .replace("{INDUSTRY}", businessType)
    .replace("{SERVICES}", input.services.map((s) => s.name).join(", ") || "Servicios generales")
    .replace("{AI_NAME}", input.aiConfig.name)
    .replace("{PERSONALITY}", personalityDescriptions[personality])
    .replace("{LANGUAGE}", "Spanish (US Hispanic market)")
    .replace("{TONE_INTENSITY}", enhancedConfig.toneIntensity.toString())
    .replace("{INDUSTRY_CONTEXT}", industryContext)
    .replace("{SENTIMENT_INSTRUCTIONS}", sentimentInstructions)
    .replace("{FEW_SHOT_EXAMPLES}", fewShotExamples)
    .replace("{ERROR_HANDLING}", errorHandling)
    .replace("{CALLER_CONTEXT}", callerContext)
    .replace("{ADDITIONAL_CONTEXT}", spanishContext + spanishAdditions);
}

/**
 * Get the appropriate prompt builder based on config
 */
export function getPromptBuilder(
  enhanced: boolean,
  language: "en" | "es"
): (input: PromptGenerationInput, config?: EnhancedPromptConfig) => string {
  if (enhanced) {
    return language === "es" ? buildEnhancedSpanishPromptRequest : buildEnhancedEnglishPromptRequest;
  }
  return language === "es"
    ? (input) => buildSpanishPromptRequest(input)
    : (input) => buildEnglishPromptRequest(input);
}
