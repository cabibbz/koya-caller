/**
 * Koya Caller - Caller Context System
 * Enhanced Prompt System - Phase 5
 *
 * Recognizes repeat callers and provides personalized context
 * to the AI for better customer experience.
 */

import { createAdminClient } from "@/lib/supabase/server";

// =============================================================================
// Types
// =============================================================================

export interface CallerPreferences {
  preferredService?: string;
  preferredProvider?: string;
  preferredTime?: string;
  preferredDay?: string;
  communicationPreference?: "call" | "text" | "email";
  notes?: string;
}

export interface CallerHistory {
  totalCalls: number;
  lastCallDate: string | null;
  lastCallOutcome: string | null;
  appointmentCount: number;
  lastAppointmentDate: string | null;
  lastServiceBooked: string | null;
  averageCallDuration?: number;
}

export interface CallerContext {
  isRepeatCaller: boolean;
  knownName: string | null;
  knownEmail: string | null;
  previousCallCount: number;
  lastCallOutcome: string | null;
  lastCallDate: string | null;
  knownPreferences: CallerPreferences;
  appointmentHistory: {
    count: number;
    lastServiceBooked: string | null;
    lastAppointmentDate: string | null;
  };
  sentiment?: {
    previousSentiment?: string;
    hadNegativeExperience?: boolean;
  };
}

export interface CallerProfile {
  id: string;
  businessId: string;
  phoneNumber: string;
  name: string | null;
  email: string | null;
  preferences: CallerPreferences;
  callCount: number;
  lastCallAt: string | null;
  lastOutcome: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CallerContextDynamicVars {
  is_repeat_caller: string;
  caller_name: string;
  previous_call_count: string;
  caller_preferences: string;
  last_service: string;
  caller_context_summary: string;
}

// =============================================================================
// Database Functions
// =============================================================================

/**
 * Fetch caller context from database
 */
export async function fetchCallerContext(
  businessId: string,
  callerNumber: string
): Promise<CallerContext> {
  const supabase = createAdminClient();

  // Default context for unknown callers
  const defaultContext: CallerContext = {
    isRepeatCaller: false,
    knownName: null,
    knownEmail: null,
    previousCallCount: 0,
    lastCallOutcome: null,
    lastCallDate: null,
    knownPreferences: {},
    appointmentHistory: {
      count: 0,
      lastServiceBooked: null,
      lastAppointmentDate: null
    }
  };

  try {
    // Normalize phone number (remove non-digits, keep country code)
    const normalizedNumber = normalizePhoneNumber(callerNumber);

    // Check caller_profiles table first (if it exists)
    const { data: profile } = await supabase
      .from("caller_profiles")
      .select("*")
      .eq("business_id", businessId)
      .eq("phone_number", normalizedNumber)
      .single();

    if (profile) {
      const callerProfile = profile as CallerProfile;
      return {
        isRepeatCaller: true,
        knownName: callerProfile.name,
        knownEmail: callerProfile.email,
        previousCallCount: callerProfile.callCount,
        lastCallOutcome: callerProfile.lastOutcome,
        lastCallDate: callerProfile.lastCallAt,
        knownPreferences: callerProfile.preferences || {},
        appointmentHistory: {
          count: 0, // Will be enriched below
          lastServiceBooked: null,
          lastAppointmentDate: null
        }
      };
    }

    // Fallback: Check calls table for history
    // Note: sentiment_detected may not exist in all databases
    const { data: calls } = await supabase
      .from("calls")
      .select("id, caller_number, outcome, created_at")
      .eq("business_id", businessId)
      .eq("caller_number", normalizedNumber)
      .order("created_at", { ascending: false })
      .limit(10);

    if (calls && calls.length > 0) {
      const callHistory = calls as Array<{
        id: string;
        caller_number: string;
        outcome: string | null;
        created_at: string;
      }>;

      // sentiment_detected column may not exist - default to false
      const hadNegativeExperience = false;

      // Get appointment history
      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, service_name, scheduled_at")
        .eq("business_id", businessId)
        .eq("customer_phone", normalizedNumber)
        .order("scheduled_at", { ascending: false })
        .limit(5);

      const appointmentList = (appointments || []) as Array<{
        id: string;
        service_name: string;
        scheduled_at: string;
      }>;

      return {
        isRepeatCaller: true,
        knownName: null, // Would need to get from appointment
        knownEmail: null,
        previousCallCount: callHistory.length,
        lastCallOutcome: callHistory[0]?.outcome || null,
        lastCallDate: callHistory[0]?.created_at || null,
        knownPreferences: {},
        appointmentHistory: {
          count: appointmentList.length,
          lastServiceBooked: appointmentList[0]?.service_name || null,
          lastAppointmentDate: appointmentList[0]?.scheduled_at || null
        },
        sentiment: {
          previousSentiment: undefined, // sentiment_detected column may not exist
          hadNegativeExperience
        }
      };
    }

    // No history found
    return defaultContext;

  } catch (_error) {
    // Return default context on error
    return defaultContext;
  }
}

/**
 * Update or create caller profile after a call
 */
export async function updateCallerProfile(
  businessId: string,
  callerNumber: string,
  updates: {
    name?: string;
    email?: string;
    outcome?: string;
    preferences?: Partial<CallerPreferences>;
  }
): Promise<void> {
  const supabase = createAdminClient();
  const normalizedNumber = normalizePhoneNumber(callerNumber);

  try {
    // Try to upsert caller profile
    const { error } = await (supabase.from("caller_profiles") as any)
      .upsert(
        {
          business_id: businessId,
          phone_number: normalizedNumber,
          name: updates.name || null,
          email: updates.email || null,
          last_outcome: updates.outcome || null,
          last_call_at: new Date().toISOString(),
          preferences: updates.preferences || {},
          call_count: 1 // Will be incremented by trigger or handled in upsert
        },
        {
          onConflict: "business_id,phone_number",
          ignoreDuplicates: false
        }
      );

    if (error) {
      // Table might not exist yet - that's okay
    }
  } catch (_error) {
    // Silently fail - profile update is not critical
  }
}

/**
 * Increment call count for a caller
 */
export async function incrementCallerCallCount(
  businessId: string,
  callerNumber: string
): Promise<void> {
  const supabase = createAdminClient();
  const normalizedNumber = normalizePhoneNumber(callerNumber);

  try {
    // Try to increment call count
    await (supabase as any).rpc("increment_caller_count", {
      p_business_id: businessId,
      p_phone_number: normalizedNumber
    });
  } catch (_error) {
    // Function might not exist - that's okay
  }
}

// =============================================================================
// Prompt Building Functions
// =============================================================================

/**
 * Build caller context section for the AI prompt
 */
export function buildCallerContextPrompt(
  context: CallerContext,
  language: "en" | "es" = "en"
): string {
  if (!context.isRepeatCaller) {
    return buildNewCallerPrompt(language);
  }

  return buildRepeatCallerPrompt(context, language);
}

/**
 * Build prompt section for new callers
 */
function buildNewCallerPrompt(language: "en" | "es"): string {
  if (language === "es") {
    return `
## Contexto del Llamante
Este es un NUEVO LLAMANTE. Haz una excelente primera impresion!
- Se acogedor y servicial
- Explica los servicios si preguntan
- Captura su informacion de contacto para futuras referencias
- Pregunta su nombre cuando sea apropiado
`;
  }

  return `
## Caller Context
This is a NEW CALLER. Make a great first impression!
- Be welcoming and helpful
- Explain services if asked
- Capture their contact information for future reference
- Ask for their name when appropriate
`;
}

/**
 * Build prompt section for repeat callers
 */
function buildRepeatCallerPrompt(
  context: CallerContext,
  language: "en" | "es"
): string {
  const {
    knownName,
    previousCallCount,
    lastCallOutcome,
    knownPreferences,
    appointmentHistory,
    sentiment
  } = context;

  if (language === "es") {
    let prompt = `
## Contexto del Llamante
Este es un LLAMANTE RECURRENTE (${previousCallCount} llamadas anteriores).
`;
    if (knownName) {
      prompt += `- Su nombre es ${knownName}\n`;
    }
    if (lastCallOutcome) {
      prompt += `- Resultado de ultima llamada: ${lastCallOutcome}\n`;
    }
    if (appointmentHistory.lastServiceBooked) {
      prompt += `- Ultimo servicio reservado: ${appointmentHistory.lastServiceBooked}\n`;
    }
    if (knownPreferences.preferredService) {
      prompt += `- Generalmente reserva: ${knownPreferences.preferredService}\n`;
    }
    if (sentiment?.hadNegativeExperience) {
      prompt += `- NOTA: Tuvo una experiencia negativa anteriormente. Se extra cuidadoso y empatico.\n`;
    }

    prompt += `
Consejos de personalizacion:
- Reconocelos: "Que gusto escucharle de nuevo!"
- Referencia su historial si es relevante
- Omite preguntas redundantes si ya tienes su informacion
`;
    return prompt;
  }

  // English version
  let prompt = `
## Caller Context
This is a REPEAT CALLER (${previousCallCount} previous calls).
`;
  if (knownName) {
    prompt += `- Their name is ${knownName}\n`;
  }
  if (lastCallOutcome) {
    prompt += `- Last call outcome: ${lastCallOutcome}\n`;
  }
  if (appointmentHistory.lastServiceBooked) {
    prompt += `- Last service booked: ${appointmentHistory.lastServiceBooked}\n`;
  }
  if (knownPreferences.preferredService) {
    prompt += `- They typically book: ${knownPreferences.preferredService}\n`;
  }
  if (knownPreferences.preferredProvider) {
    prompt += `- Preferred provider: ${knownPreferences.preferredProvider}\n`;
  }
  if (knownPreferences.preferredTime) {
    prompt += `- Usually prefers: ${knownPreferences.preferredTime} appointments\n`;
  }
  if (sentiment?.hadNegativeExperience) {
    prompt += `- NOTE: They had a negative experience previously. Be extra careful and empathetic.\n`;
  }

  prompt += `
Personalization tips:
- Acknowledge them: "Good to hear from you again!"
- Reference their history if relevant
- Skip redundant questions if you have their info
`;

  return prompt;
}

/**
 * Build dynamic variables for Retell from caller context
 */
export function buildCallerContextDynamicVars(
  context: CallerContext
): CallerContextDynamicVars {
  const preferenceSummary = buildPreferenceSummary(context.knownPreferences);
  const contextSummary = buildContextSummary(context);

  return {
    is_repeat_caller: context.isRepeatCaller ? "true" : "false",
    caller_name: context.knownName || "",
    previous_call_count: context.previousCallCount.toString(),
    caller_preferences: preferenceSummary,
    last_service: context.appointmentHistory.lastServiceBooked || "",
    caller_context_summary: contextSummary
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalize phone number for consistent lookup
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  const hasPlus = phone.startsWith("+");
  const digits = phone.replace(/\D/g, "");

  // If it has a plus, preserve it; otherwise add +1 for US numbers
  if (hasPlus) {
    return `+${digits}`;
  }

  // Assume US number if 10 digits
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Otherwise, add plus
  return `+${digits}`;
}

/**
 * Build a summary of caller preferences
 */
function buildPreferenceSummary(preferences: CallerPreferences): string {
  const parts: string[] = [];

  if (preferences.preferredService) {
    parts.push(`prefers ${preferences.preferredService}`);
  }
  if (preferences.preferredProvider) {
    parts.push(`with ${preferences.preferredProvider}`);
  }
  if (preferences.preferredTime) {
    parts.push(`at ${preferences.preferredTime}`);
  }
  if (preferences.preferredDay) {
    parts.push(`on ${preferences.preferredDay}s`);
  }

  return parts.length > 0 ? parts.join(", ") : "No known preferences";
}

/**
 * Build a brief context summary for dynamic variables
 */
function buildContextSummary(context: CallerContext): string {
  if (!context.isRepeatCaller) {
    return "New caller - first time calling";
  }

  const parts: string[] = [];
  parts.push(`Called ${context.previousCallCount} times before`);

  if (context.knownName) {
    parts.push(`Name: ${context.knownName}`);
  }
  if (context.appointmentHistory.lastServiceBooked) {
    parts.push(`Last booked: ${context.appointmentHistory.lastServiceBooked}`);
  }
  if (context.sentiment?.hadNegativeExperience) {
    parts.push("Had negative experience - be extra helpful");
  }

  return parts.join(". ");
}

/**
 * Check if caller should be treated as VIP (frequent caller)
 */
export function isVIPCaller(context: CallerContext): boolean {
  return context.previousCallCount >= 5 || context.appointmentHistory.count >= 3;
}

/**
 * Get personalized greeting based on caller context
 */
export function getPersonalizedGreeting(
  context: CallerContext,
  businessName: string,
  aiName: string,
  language: "en" | "es" = "en"
): string {
  if (!context.isRepeatCaller) {
    // New caller
    return language === "es"
      ? `Gracias por llamar a ${businessName}. Soy ${aiName}, en que puedo ayudarle?`
      : `Thank you for calling ${businessName}. This is ${aiName}, how may I help you?`;
  }

  if (context.knownName) {
    // Known repeat caller
    return language === "es"
      ? `Hola ${context.knownName}! Gracias por llamar a ${businessName}. Soy ${aiName}, que gusto escucharle de nuevo. En que puedo ayudarle hoy?`
      : `Hi ${context.knownName}! Thanks for calling ${businessName}. This is ${aiName}, great to hear from you again. How can I help you today?`;
  }

  // Repeat caller without name
  return language === "es"
    ? `Gracias por llamar a ${businessName} de nuevo. Soy ${aiName}, en que puedo ayudarle hoy?`
    : `Thanks for calling ${businessName} again. This is ${aiName}, how can I help you today?`;
}

/**
 * Get suggested follow-up based on last interaction
 */
export function getSuggestedFollowUp(context: CallerContext): string | null {
  if (!context.isRepeatCaller) return null;

  // If last call was a missed booking attempt
  if (context.lastCallOutcome === "no_availability") {
    return "They couldn't book last time due to availability. Check if they're still looking.";
  }

  // If they had an appointment scheduled
  if (context.appointmentHistory.lastAppointmentDate) {
    const lastAppt = new Date(context.appointmentHistory.lastAppointmentDate);
    const now = new Date();
    const daysSinceAppt = Math.floor((now.getTime() - lastAppt.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceAppt < 0) {
      return "They have an upcoming appointment. May be calling about it.";
    } else if (daysSinceAppt <= 7) {
      return "They recently visited. May be calling with follow-up questions.";
    }
  }

  // If they had a negative experience
  if (context.sentiment?.hadNegativeExperience) {
    return "Previous negative experience noted. Be especially attentive.";
  }

  return null;
}

/**
 * Determine if we should ask for the caller's name
 */
export function shouldAskForName(context: CallerContext): boolean {
  // Don't ask if we already know their name
  if (context.knownName) return false;

  // Ask repeat callers who we don't have a name for
  if (context.isRepeatCaller && context.previousCallCount >= 2) return true;

  // Ask new callers during booking flow (handled separately)
  return false;
}
