/**
 * Demo Call Initiation API
 *
 * Spec Reference: Part 20, Line 2141 (3 requests per 1 hour per IP)
 * Spec Reference: Part 3, Lines 132-158 (Demo Koya behavior)
 *
 * This route handles:
 * 1. Demo calls from landing page (with email)
 * 2. Test calls from onboarding Step 9 (with businessId)
 *
 * Features:
 * - Rate limiting: 3 calls per hour per IP
 * - Lead capture: Saves email to demo_leads table
 * - Demo-specific agent with Demo Koya personality
 *
 * Returns an access_token for use with retell-client-js-sdk
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

// Input validation schema
const demoCallSchema = z.object({
  email: z.string().email().max(255).optional(),
  businessId: z.string().uuid().optional(),
  language: z.enum(["en", "es"]).optional().default("en"),
  leadId: z.string().uuid().optional(),
}).refine(data => data.email || data.businessId, {
  message: "Either email or businessId is required"
});

// Check if Retell is configured
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Rate limit config
const RATE_LIMIT_MAX_CALLS = 3;
const RATE_LIMIT_WINDOW_MINUTES = 60;

export interface DemoCallRequest {
  email?: string;
  businessId?: string;
  language?: "en" | "es";
  leadId?: string;
}

export interface DemoCallResponse {
  success: boolean;
  accessToken?: string;
  callId?: string;
  leadId?: string;
  error?: string;
  mock?: boolean;
  rateLimited?: boolean;
  remainingCalls?: number;
}

// Demo Koya personality prompt
const DEMO_KOYA_PROMPT = `You are Koya, an AI phone receptionist demonstrating your capabilities to a potential customer. Be friendly, enthusiastic, and professional.

DEMO INTRODUCTION:
"Hi there! I'm Koya, your AI phone receptionist. I'm so excited to show you what I can do! Would you like me to demonstrate how I can book appointments, answer questions about your business, or handle customer calls? Just tell me what you'd like to see!"

YOUR CAPABILITIES TO DEMONSTRATE:
1. **Appointment Booking**: Walk through a sample booking flow
   - "Let's pretend you're a customer calling to book a haircut. Just say something like 'I'd like to book an appointment'"
   - Ask for their preferred date/time
   - Confirm the booking

2. **FAQ Handling**: Answer common business questions
   - "Ask me anything a customer might ask, like 'What are your hours?' or 'How much does a service cost?'"
   - Make up reasonable sample answers

3. **Call Handling**: Show how you'd handle different scenarios
   - Urgent calls: "I can escalate urgent matters immediately"
   - Message taking: "I can take detailed messages when the business is closed"
   - Call transfers: "I can transfer to the right person for complex issues"

4. **Bilingual Support**: If they ask, demonstrate Spanish
   - "¡También hablo español! Pregúntame algo en español."

PERSONALITY:
- Warm and enthusiastic but professional
- Explain what you're doing as you demo ("Now I would normally check the calendar...")
- Keep responses concise for phone conversations
- Encourage them to try different scenarios
- End by asking if they'd like to sign up for Koya

CLOSING:
After demonstrating, say something like:
"That's just a taste of what I can do! With Koya, you'll never miss another call. Would you like to set up Koya for your business? It only takes about 5 minutes!"`;

const DEMO_KOYA_PROMPT_ES = `Eres Koya, una recepcionista telefónica de IA que demuestra tus capacidades a un cliente potencial. Sé amable, entusiasta y profesional.

INTRODUCCIÓN DE DEMOSTRACIÓN:
"¡Hola! Soy Koya, tu recepcionista telefónica de IA. ¡Estoy muy emocionada de mostrarte lo que puedo hacer! ¿Te gustaría que te demuestre cómo puedo reservar citas, responder preguntas sobre tu negocio o manejar llamadas de clientes? ¡Solo dime qué te gustaría ver!"

TUS CAPACIDADES PARA DEMOSTRAR:
1. **Reserva de Citas**: Explica el flujo de reservación
2. **Manejo de Preguntas Frecuentes**: Responde preguntas comunes
3. **Manejo de Llamadas**: Muestra cómo manejas diferentes escenarios
4. **Soporte Bilingüe**: Cambia entre inglés y español según sea necesario

PERSONALIDAD:
- Cálida y entusiasta pero profesional
- Mantén las respuestas concisas para conversaciones telefónicas
- Anima a probar diferentes escenarios

CIERRE:
Después de demostrar, pregunta si les gustaría registrarse en Koya.`;

// Get client IP address
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  return "unknown";
}

// Check rate limit using in-memory store (for edge runtime compatibility)
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

// Cleanup tracking for memory leak prevention
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60 * 1000;

function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;

  lastCleanup = now;
  const windowMs = RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
  Array.from(rateLimitStore.entries()).forEach(([key, record]) => {
    if (now - record.windowStart > windowMs + 60000) {
      rateLimitStore.delete(key);
    }
  });
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  // Clean up expired entries periodically
  cleanupExpiredEntries();

  const now = Date.now();
  const windowMs = RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

  const record = rateLimitStore.get(ip);

  if (!record || (now - record.windowStart) > windowMs) {
    // New window
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_CALLS - 1 };
  }

  if (record.count < RATE_LIMIT_MAX_CALLS) {
    record.count++;
    rateLimitStore.set(ip, record);
    return { allowed: true, remaining: RATE_LIMIT_MAX_CALLS - record.count };
  }

  return { allowed: false, remaining: 0 };
}

/**
 * POST /api/demo/call
 *
 * Initiates a demo/test call via Retell WebRTC.
 * Returns access_token for client SDK.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const rawBody = await request.json();

    // Validate input
    const parseResult = demoCallSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.errors[0]?.message || "Invalid request" },
        { status: 400 }
      );
    }

    const { email, businessId, language } = parseResult.data;

    const clientIP = getClientIP(request);

    // Test calls (businessId) require authentication and ownership verification
    if (businessId) {
      const supabase = await createServerClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { success: false, error: "Authentication required for test calls" },
          { status: 401 }
        );
      }

      // Verify user owns the business
      const { data: business, error: bizError } = await (supabase as any)
        .from("businesses")
        .select("id, user_id")
        .eq("id", businessId)
        .single() as { data: { id: string; user_id: string } | null; error: any };

      if (bizError || !business || business.user_id !== user.id) {
        return NextResponse.json(
          { success: false, error: "Forbidden" },
          { status: 403 }
        );
      }
    }

    // Rate limit demo calls (unauthenticated calls with email)
    if (email && !businessId) {
      const rateCheck = checkRateLimit(clientIP);

      if (!rateCheck.allowed) {
        return NextResponse.json({
          success: false,
          rateLimited: true,
          error: "You've reached the demo limit. Sign up to get unlimited access!",
          remainingCalls: 0,
        }, { status: 429 });
      }
    }

    // Save lead to database if email provided
    let leadId: string | undefined;
    if (email && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: lead, error } = await supabase
          .from("demo_leads")
          .insert({
            email,
            ip_address: clientIP,
            language,
          })
          .select("id")
          .single();

        if (!error && lead) {
          leadId = lead.id;
        }
      } catch (_dbError) {
        // Non-fatal - continue with call even if lead capture fails
      }
    }

    // If no Retell API key, return mock response
    if (!RETELL_API_KEY) {
      return NextResponse.json({
        success: false,
        mock: true,
        leadId,
        error: "Demo calls are temporarily unavailable. Please try again later.",
      });
    }

    // Import Retell SDK
    const Retell = (await import("retell-sdk")).default;
    const retell = new Retell({ apiKey: RETELL_API_KEY });

    // Get or create an agent for this call
    let agentId: string;

    try {
      if (businessId) {
        // For test calls during onboarding, use the business's configured Retell agent
        // This agent already has all functions registered (including integrations)
        const supabase = await createServerClient();
        const { data: aiConfig } = await (supabase as any)
          .from("ai_config")
          .select("retell_agent_id, retell_agent_id_spanish")
          .eq("business_id", businessId)
          .single() as { data: { retell_agent_id: string | null; retell_agent_id_spanish: string | null } | null };

        if (aiConfig?.retell_agent_id) {
          // Use the business's configured agent (Spanish if requested and available)
          agentId = (language === "es" && aiConfig.retell_agent_id_spanish)
            ? aiConfig.retell_agent_id_spanish
            : aiConfig.retell_agent_id;
        } else {
          // Business has no agent configured - create a basic test agent
          const agents = await retell.agent.list();
          if (agents.length > 0) {
            agentId = agents[0].agent_id;
          } else {
            const agent = await retell.agent.create({
              agent_name: "Koya Test Agent",
              voice_id: "11labs-Grace",
              response_engine: {
                type: "retell-llm",
                llm_id: "",
              },
              language: language === "es" ? "es-ES" : "en-US",
            });
            agentId = agent.agent_id;
          }
        }
      } else {
        // Demo call - list agents to find or create Demo Koya
        const agents = await retell.agent.list();
        // Demo call - use or create Demo Koya agent
        const demoAgentName = language === "es" ? "Demo Koya ES" : "Demo Koya";
        const demoAgent = agents.find((a) => a.agent_name === demoAgentName);

        if (demoAgent) {
          agentId = demoAgent.agent_id;
        } else {
          // Create the Demo Koya agent with personality prompt
          try {
            // First create an LLM with the demo prompt
            const llm = await retell.llm.create({
              general_prompt: language === "es" ? DEMO_KOYA_PROMPT_ES : DEMO_KOYA_PROMPT,
              begin_message: language === "es"
                ? "¡Hola! Soy Koya, tu recepcionista de IA. ¿Qué te gustaría que te demuestre hoy?"
                : "Hi there! I'm Koya, your AI phone receptionist. What would you like me to show you today?",
            });

            const agent = await retell.agent.create({
              agent_name: demoAgentName,
              voice_id: language === "es" ? "11labs-Hailey" : "11labs-Grace",
              response_engine: {
                type: "retell-llm",
                llm_id: llm.llm_id,
              },
              language: language === "es" ? "es-ES" : "en-US",
            });
            agentId = agent.agent_id;
          } catch (createError) {
            // Fallback to first available agent
            if (agents.length > 0) {
              agentId = agents[0].agent_id;
            } else {
              throw createError;
            }
          }
        }
      }
    } catch (_agentError) {
      return NextResponse.json({
        success: false,
        leadId,
        error: "Failed to get/create agent. Check your Retell API key.",
      }, { status: 500 });
    }

    // Create a web call - returns access_token for client SDK
    // Note: For demo/test calls, we don't have a koya_call_id since no call record is created
    // The function handler handles empty koya_call_id gracefully
    const webCall = await retell.call.createWebCall({
      agent_id: agentId,
      metadata: {
        source: businessId ? "onboarding_test" : "landing_demo",
        business_id: businessId || "",  // snake_case to match function handler expectations
        koya_call_id: "",  // No call record for demo/test calls
        email: email || undefined,
        leadId: leadId || undefined,
        language,
      },
    });

    return NextResponse.json({
      success: true,
      callId: webCall.call_id,
      accessToken: webCall.access_token,
      leadId,
    });

  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to initiate call"
      },
      { status: 500 }
    );
  }
}

// Prevent other HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST to initiate a demo call." },
    { status: 405 }
  );
}
