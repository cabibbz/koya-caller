/**
 * Koya Caller - Retell.ai Integration Library
 * Session 13: Retell.ai Integration
 * Spec Reference: Part 11, Lines 1268-1526
 *
 * This module provides the core Retell.ai functionality:
 * - Agent creation and management
 * - WebRTC browser calls for demos
 * - Phone call registration
 * - Webhook signature verification
 */

import Retell from "retell-sdk";
import type {
  AgentCreateParams,
  AgentResponse,
  WebCallParams,
  WebCallResponse,
  PhoneCallRegisterParams,
  PhoneCallResponse,
  DynamicVariables,
} from "./types";
import { RETELL_FUNCTIONS, prepareDynamicVariables } from "./functions";

// =============================================================================
// Retell Client
// =============================================================================

const RETELL_API_KEY = process.env.RETELL_API_KEY;

/**
 * Get Retell client instance
 * Returns null if API key is not configured (for mock mode)
 */
export function getRetellClient(): Retell | null {
  if (!RETELL_API_KEY) {
    console.warn("[Retell] API key not configured, running in mock mode");
    return null;
  }
  return new Retell({ apiKey: RETELL_API_KEY });
}

/**
 * Check if Retell is configured
 */
export function isRetellConfigured(): boolean {
  return !!RETELL_API_KEY;
}

// =============================================================================
// Agent Management (Spec Lines 1284-1293, 1379-1393)
// =============================================================================

/**
 * Create a Retell LLM configuration
 * This creates the "brain" of the agent with the system prompt
 */
export async function createRetellLLM(options: {
  systemPrompt: string;
  beginMessage: string;
  functions?: typeof RETELL_FUNCTIONS;
}): Promise<{ llm_id: string } | null> {
  const client = getRetellClient();
  if (!client) {
    // Mock mode
    return { llm_id: `llm_mock_${Date.now()}` };
  }

  try {
    // Use any to avoid SDK version type conflicts
    const llmConfig: Record<string, unknown> = {
      model: "gpt-4.1", // Use gpt-4.1 as per Retell SDK types
      general_prompt: options.systemPrompt,
      begin_message: options.beginMessage,
    };

    // Add custom tools if provided
    if (options.functions) {
      llmConfig.general_tools = options.functions.map((fn) => ({
        type: "custom",
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters,
        speak_after_execution: true,
        url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://koya-caller.com'}/api/retell/function`,
      }));
    }

    const llm = await client.llm.create(llmConfig);

    return { llm_id: llm.llm_id };
  } catch (error) {
    console.error("[Retell] Failed to create LLM:", error);
    throw error;
  }
}

/**
 * Create a Retell agent with voice configuration
 * Spec Reference: Part 11, Lines 1284-1293
 */
export async function createAgent(params: AgentCreateParams): Promise<AgentResponse | null> {
  const client = getRetellClient();

  // Prepare greeting based on personality
  const beginMessage = params.spanishEnabled && params.greetingSpanish
    ? `${params.greeting} / ${params.greetingSpanish}`
    : params.greeting;

  if (!client) {
    // Mock mode - return fake agent
    console.log("[Retell Mock] Creating agent:", params.businessName);
    return {
      agent_id: `agent_mock_${Date.now()}`,
      llm_id: `llm_mock_${Date.now()}`,
      voice_id: params.voiceId,
      language: params.language,
      created_at: new Date().toISOString(),
    };
  }

  try {
    // First, create the LLM with the system prompt
    const llm = await createRetellLLM({
      systemPrompt: params.systemPrompt,
      beginMessage,
      functions: RETELL_FUNCTIONS,
    });

    if (!llm) {
      throw new Error("Failed to create LLM");
    }

    // Then create the agent with voice settings
    // Spec Reference: Lines 1284-1293 (Multilingual agent configuration)
    const agentConfig: Parameters<typeof client.agent.create>[0] = {
      response_engine: {
        type: "retell-llm",
        llm_id: llm.llm_id,
      },
      voice_id: params.voiceId,
      agent_name: `${params.businessName} - ${params.aiName}`,
    };

    // Add multilingual settings if Spanish is enabled
    if (params.spanishEnabled) {
      // Use ElevenLabs multilingual model
      // @ts-ignore - Adding multilingual properties to agent config
      agentConfig.voice_model = "eleven_multilingual_v2";
      // @ts-ignore
      agentConfig.language = "multi";
      // @ts-ignore
      agentConfig.backchannel_words = [
        "yeah",
        "uh-huh",
        "mhm",
        "ajá",
        "sí",
        "vale",
      ];
    }

    const agent = await client.agent.create(agentConfig);

    return {
      agent_id: agent.agent_id,
      llm_id: llm.llm_id,
      voice_id: params.voiceId,
      language: params.language,
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[Retell] Failed to create agent:", error);
    throw error;
  }
}

/**
 * Update an existing Retell agent
 */
export async function updateAgent(
  agentId: string,
  updates: Partial<AgentCreateParams>
): Promise<boolean> {
  const client = getRetellClient();

  if (!client) {
    console.log("[Retell Mock] Updating agent:", agentId);
    return true;
  }

  try {
    // Note: Updating requires recreating the LLM if system prompt changes
    if (updates.systemPrompt) {
      // Create new LLM with updated prompt
      const llm = await createRetellLLM({
        systemPrompt: updates.systemPrompt,
        beginMessage: updates.greeting || "Hello, how can I help you?",
        functions: RETELL_FUNCTIONS,
      });

      if (llm) {
        await client.agent.update(agentId, {
          response_engine: {
            type: "retell-llm",
            llm_id: llm.llm_id,
          },
        });
      }
    }

    // Update voice if changed
    if (updates.voiceId) {
      await client.agent.update(agentId, {
        voice_id: updates.voiceId,
      });
    }

    return true;
  } catch (error) {
    console.error("[Retell] Failed to update agent:", error);
    return false;
  }
}

/**
 * Delete a Retell agent
 */
export async function deleteAgent(agentId: string): Promise<boolean> {
  const client = getRetellClient();

  if (!client) {
    console.log("[Retell Mock] Deleting agent:", agentId);
    return true;
  }

  try {
    await client.agent.delete(agentId);
    return true;
  } catch (error) {
    console.error("[Retell] Failed to delete agent:", error);
    return false;
  }
}

// =============================================================================
// WebRTC Browser Calls (Spec Lines 1295-1330)
// =============================================================================

/**
 * Create a WebRTC call for browser-based demo
 * Spec Reference: Part 11, Lines 1295-1330
 */
export async function createWebCall(params: WebCallParams): Promise<WebCallResponse | null> {
  const client = getRetellClient();

  if (!client) {
    // Mock mode
    console.log("[Retell Mock] Creating web call for agent:", params.agentId);
    return {
      access_token: `mock_token_${Date.now()}`,
      call_id: `call_mock_${Date.now()}`,
      agent_id: params.agentId,
    };
  }

  try {
    const webCall = await client.call.createWebCall({
      agent_id: params.agentId,
      retell_llm_dynamic_variables: params.dynamicVariables,
      metadata: params.metadata,
    });

    return {
      access_token: webCall.access_token,
      call_id: webCall.call_id,
      agent_id: params.agentId,
    };
  } catch (error) {
    console.error("[Retell] Failed to create web call:", error);
    throw error;
  }
}

// =============================================================================
// Phone Call Registration (For Twilio Integration)
// =============================================================================

/**
 * Register an incoming phone call with Retell
 * This is called when Twilio routes a call to our handler
 */
export async function registerPhoneCall(
  params: PhoneCallRegisterParams
): Promise<PhoneCallResponse | null> {
  const client = getRetellClient();

  if (!client) {
    // Mock mode
    console.log("[Retell Mock] Registering phone call:", params);
    return {
      call_id: `call_mock_${Date.now()}`,
      agent_id: params.agentId,
      call_type: "phone_call",
    };
  }

  try {
    const phoneCall = await client.call.registerPhoneCall({
      agent_id: params.agentId,
      from_number: params.fromNumber,
      to_number: params.toNumber,
      retell_llm_dynamic_variables: params.dynamicVariables,
      metadata: params.metadata,
    });

    return {
      call_id: phoneCall.call_id,
      agent_id: params.agentId,
      call_type: "phone_call",
    };
  } catch (error) {
    console.error("[Retell] Failed to register phone call:", error);
    throw error;
  }
}

// =============================================================================
// Webhook Verification (Spec Lines 1368-1377)
// =============================================================================

/**
 * Verify Retell webhook signature
 * Spec Reference: Part 11, Lines 1368-1377
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  if (!RETELL_API_KEY || !signature) {
    console.warn("[Retell] Cannot verify webhook - missing API key or signature");
    return false;
  }

  try {
    return Retell.verify(payload, RETELL_API_KEY, signature);
  } catch (error) {
    console.error("[Retell] Webhook verification failed:", error);
    return false;
  }
}

// =============================================================================
// Demo Agent Management
// =============================================================================

// Demo agent ID - set via environment or create on demand
const DEMO_AGENT_ID = process.env.RETELL_DEMO_AGENT_ID;

/**
 * Get or create the demo agent
 * Spec Reference: Part 3, Lines 140-158
 */
export async function getDemoAgent(): Promise<string | null> {
  if (DEMO_AGENT_ID) {
    return DEMO_AGENT_ID;
  }

  // In production, you'd want to create this once and store the ID
  // For now, we'll create a mock agent
  if (!isRetellConfigured()) {
    return `demo_agent_mock`;
  }

  // TODO: Create a dedicated demo agent with demo prompt
  // This would be done during initial setup
  console.warn("[Retell] No demo agent configured. Set RETELL_DEMO_AGENT_ID");
  return null;
}

/**
 * Create a demo WebRTC call
 * Used for the landing page "Demo Koya" feature
 */
export async function createDemoCall(options: {
  email: string;
  language?: "en" | "es";
}): Promise<WebCallResponse | null> {
  const demoAgentId = await getDemoAgent();

  if (!demoAgentId) {
    throw new Error("Demo agent not configured");
  }

  return createWebCall({
    agentId: demoAgentId,
    dynamicVariables: {
      business_name: "Sunrise Dental",
      ai_name: "Koya",
      minutes_exhausted: "false",
      after_hours: "false",
      can_book: "true",
      transfer_enabled: "false", // No transfers in demo
      spanish_enabled: options.language === "es" ? "true" : "false",
      language_mode: options.language === "es" ? "spanish_default" : "auto",
      today_date: new Date().toISOString().split("T")[0],
      current_time: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    },
    metadata: {
      demo: "true",
      email: options.email,
    },
  });
}

// =============================================================================
// Call Analysis Helpers
// =============================================================================

/**
 * Parse transcript into readable format
 */
export function formatTranscript(
  transcript: { role: string; content: string }[]
): string {
  return transcript
    .map((entry) => {
      const speaker = entry.role === "agent" ? "Koya" : "Caller";
      return `${speaker}: ${entry.content}`;
    })
    .join("\n");
}

/**
 * Extract key information from a call
 */
export function extractCallInfo(callData: {
  transcript?: { role: string; content: string }[];
  call_analysis?: {
    call_summary?: string;
    user_sentiment?: string;
    reason_for_call?: string;
  };
  duration_ms?: number;
}): {
  summary: string;
  sentiment: string;
  reason: string;
  durationSeconds: number;
  durationMinutesBilled: number;
} {
  const durationSeconds = Math.ceil((callData.duration_ms || 0) / 1000);
  const durationMinutesBilled = Math.ceil(durationSeconds / 60);

  return {
    summary: callData.call_analysis?.call_summary || "No summary available",
    sentiment: callData.call_analysis?.user_sentiment || "neutral",
    reason: callData.call_analysis?.reason_for_call || "Unknown",
    durationSeconds,
    durationMinutesBilled,
  };
}

// =============================================================================
// Exports
// =============================================================================

export {
  RETELL_FUNCTIONS,
  prepareDynamicVariables,
  type DynamicVariables,
  type AgentCreateParams,
  type AgentResponse,
  type WebCallParams,
  type WebCallResponse,
  type PhoneCallRegisterParams,
  type PhoneCallResponse,
};

// Re-export types
export * from "./types";
export * from "./functions";
