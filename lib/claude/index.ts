/**
 * Koya Caller - Claude API Client
 * Session 14: Claude API Integration
 * Session 23: Enhanced Error Handling
 * Spec Reference: Part 15, Lines 1758-1916
 *
 * Handles prompt generation using Claude API with:
 * - Mock mode fallback for development
 * - Retry logic for transient failures
 * - Error logging to system_logs
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  PromptGenerationInput,
  GeneratedPrompts,
  PromptGenerationResult,
} from "./types";
import {
  buildEnglishPromptRequest,
  buildSpanishPromptRequest,
  buildLanguageSwitchingInstructions,
  generateMockEnglishPrompt,
  generateMockSpanishPrompt,
} from "./meta-prompt";
import {
  withRetry,
  isClaudeRetryable,
  handleClaudeFailure,
} from "@/lib/errors";

// =============================================================================
// Configuration
// =============================================================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = "claude-sonnet-4-5-20250929"; // Spec Line 1828

/**
 * Check if Claude API is configured
 */
export function isClaudeConfigured(): boolean {
  return !!ANTHROPIC_API_KEY;
}

/**
 * Get Claude client (or null if not configured)
 */
function getClient(): Anthropic | null {
  if (!ANTHROPIC_API_KEY) {
    return null;
  }
  return new Anthropic({ apiKey: ANTHROPIC_API_KEY });
}

// =============================================================================
// Token Counting (Approximate)
// =============================================================================

/**
 * Approximate token count (rough estimate: ~4 chars per token)
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

// =============================================================================
// Prompt Generation
// =============================================================================

/**
 * Generate system prompts for a business
 * Spec Reference: Lines 1881-1888
 *
 * @param input - Business context and configuration
 * @returns Generated prompts (English and optionally Spanish)
 */
export async function generatePrompts(
  input: PromptGenerationInput
): Promise<PromptGenerationResult> {
  const client = getClient();

  // Mock mode if no API key
  if (!client) {
    return generateMockPrompts(input);
  }

  try {
    // Generate English prompt (always)
    const englishPrompt = await generateEnglishPrompt(client, input);

    // Generate Spanish prompt if enabled
    let spanishPrompt: string | undefined;
    if (input.languageSettings.spanishEnabled) {
      spanishPrompt = await generateSpanishPrompt(client, input);
    }

    // Add language switching instructions if bilingual
    let finalEnglishPrompt = englishPrompt;
    if (input.languageSettings.spanishEnabled) {
      const switchInstructions = buildLanguageSwitchingInstructions(
        input.languageSettings.languageMode
      );
      finalEnglishPrompt = englishPrompt + "\n" + switchInstructions;
    }

    const prompts: GeneratedPrompts = {
      englishPrompt: finalEnglishPrompt,
      spanishPrompt,
      version: 1, // Will be incremented by caller
      generatedAt: new Date().toISOString(),
      tokenCount: {
        english: estimateTokenCount(finalEnglishPrompt),
        spanish: spanishPrompt ? estimateTokenCount(spanishPrompt) : undefined,
      },
    };

    return {
      success: true,
      prompts,
      mock: false,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      mock: false,
    };
  }
}

/**
 * Generate English system prompt
 * Uses retry logic for transient API failures
 */
async function generateEnglishPrompt(
  client: Anthropic,
  input: PromptGenerationInput
): Promise<string> {
  const metaPrompt = buildEnglishPromptRequest(input);

  const response = await withRetry(
    () =>
      client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: metaPrompt,
          },
        ],
      }),
    {
      maxAttempts: 3,
      initialDelayMs: 2000,
      maxDelayMs: 10000,
      retryIf: isClaudeRetryable,
    }
  );

  // Extract text from response
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return textBlock.text;
}

/**
 * Generate Spanish system prompt
 * Spec Reference: Lines 1822-1842
 * Uses retry logic for transient API failures
 */
async function generateSpanishPrompt(
  client: Anthropic,
  input: PromptGenerationInput
): Promise<string> {
  const metaPrompt = buildSpanishPromptRequest(input);

  const response = await withRetry(
    () =>
      client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: metaPrompt,
          },
        ],
      }),
    {
      maxAttempts: 3,
      initialDelayMs: 2000,
      maxDelayMs: 10000,
      retryIf: isClaudeRetryable,
    }
  );

  // Extract text from response
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return textBlock.text;
}

// =============================================================================
// Mock Mode
// =============================================================================

/**
 * Generate mock prompts for development/testing
 */
function generateMockPrompts(
  input: PromptGenerationInput
): PromptGenerationResult {
  const englishPrompt = generateMockEnglishPrompt(input);
  
  let spanishPrompt: string | undefined;
  if (input.languageSettings.spanishEnabled) {
    spanishPrompt = generateMockSpanishPrompt(input);
  }

  // Add language switching for bilingual mode
  let finalEnglishPrompt = englishPrompt;
  if (input.languageSettings.spanishEnabled) {
    const switchInstructions = buildLanguageSwitchingInstructions(
      input.languageSettings.languageMode
    );
    finalEnglishPrompt = englishPrompt + "\n" + switchInstructions;
  }

  const prompts: GeneratedPrompts = {
    englishPrompt: finalEnglishPrompt,
    spanishPrompt,
    version: 1,
    generatedAt: new Date().toISOString(),
    tokenCount: {
      english: estimateTokenCount(finalEnglishPrompt),
      spanish: spanishPrompt ? estimateTokenCount(spanishPrompt) : undefined,
    },
  };

  return {
    success: true,
    prompts,
    mock: true,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Validate prompt generation input
 */
export function validatePromptInput(input: unknown): input is PromptGenerationInput {
  if (!input || typeof input !== "object") return false;

  const i = input as Record<string, unknown>;

  // Required fields
  if (!i.business || typeof i.business !== "object") return false;
  if (!i.aiConfig || typeof i.aiConfig !== "object") return false;
  if (!i.languageSettings || typeof i.languageSettings !== "object") return false;
  if (!i.callSettings || typeof i.callSettings !== "object") return false;
  if (!i.bookingSettings || typeof i.bookingSettings !== "object") return false;

  // Business must have name and type
  const business = i.business as Record<string, unknown>;
  if (typeof business.name !== "string" || !business.name) return false;
  if (typeof business.type !== "string" || !business.type) return false;

  // AI config must have name and personality
  const aiConfig = i.aiConfig as Record<string, unknown>;
  if (typeof aiConfig.name !== "string" || !aiConfig.name) return false;
  if (!["professional", "friendly", "casual"].includes(aiConfig.personality as string)) return false;

  return true;
}

/**
 * Build prompt generation input from database records
 */
export function buildPromptInputFromDatabase(data: {
  business: {
    name: string;
    business_type: string;
    address?: string | null;
    website?: string | null;
    service_area?: string | null;
    differentiator?: string | null;
  };
  businessHours: Array<{
    day_of_week: number;
    open_time: string | null;
    close_time: string | null;
    is_closed: boolean;
  }>;
  timezone: string;
  services: Array<{
    name: string;
    description?: string | null;
    duration_minutes: number;
    price_cents?: number | null;
  }>;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  knowledge?: {
    content?: string | null;
    never_say?: string | null;
  } | null;
  aiConfig: {
    ai_name: string;
    personality: string;
    greeting?: string | null;
    greeting_spanish?: string | null;
    spanish_enabled: boolean;
    language_mode: string;
  };
  callSettings: {
    transfer_number?: string | null;
    transfer_on_request: boolean;
    transfer_on_emergency: boolean;
    transfer_on_upset: boolean;
    after_hours_enabled: boolean;
    after_hours_can_book: boolean;
  };
  bookingSettings?: {
    enabled: boolean;
    require_confirmation: boolean;
    buffer_minutes: number;
    max_advance_days: number;
  } | null;
  minutesRemaining: number;
  minutesExhausted: boolean;
}): PromptGenerationInput {
  // Convert day_of_week to day names
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
  const hours: PromptGenerationInput["business"]["hours"] = {
    timezone: data.timezone,
  };

  for (const h of data.businessHours) {
    const dayName = dayNames[h.day_of_week];
    if (!h.is_closed && h.open_time && h.close_time) {
      hours[dayName] = { open: h.open_time, close: h.close_time };
    } else {
      hours[dayName] = null;
    }
  }

  return {
    business: {
      name: data.business.name,
      type: data.business.business_type || "General Business",
      address: data.business.address || undefined,
      website: data.business.website || undefined,
      serviceArea: data.business.service_area || undefined,
      differentiator: data.business.differentiator || undefined,
      hours,
    },
    services: data.services.map((s) => ({
      name: s.name,
      description: s.description || undefined,
      duration_minutes: s.duration_minutes,
      price: s.price_cents ? s.price_cents / 100 : undefined, // Convert cents to dollars
    })),
    faqs: data.faqs.map((f) => ({
      question: f.question,
      answer: f.answer,
    })),
    additionalKnowledge: data.knowledge?.content || undefined,
    neverSay: data.knowledge?.never_say || undefined,
    aiConfig: {
      name: data.aiConfig.ai_name || "Koya",
      personality: (data.aiConfig.personality || "professional") as "professional" | "friendly" | "casual",
      greeting: data.aiConfig.greeting || `Thanks for calling ${data.business.name}, this is ${data.aiConfig.ai_name || "Koya"}, how can I help you?`,
      greetingSpanish: data.aiConfig.greeting_spanish || undefined,
    },
    languageSettings: {
      spanishEnabled: data.aiConfig.spanish_enabled,
      languageMode: (data.aiConfig.language_mode || "auto") as "auto" | "ask" | "spanish_default",
    },
    callSettings: {
      transferEnabled: !!data.callSettings.transfer_number,
      transferNumber: data.callSettings.transfer_number || undefined,
      transferOnRequest: data.callSettings.transfer_on_request,
      transferOnEmergency: data.callSettings.transfer_on_emergency,
      transferOnUpset: data.callSettings.transfer_on_upset,
      afterHoursEnabled: data.callSettings.after_hours_enabled,
      afterHoursCanBook: data.callSettings.after_hours_can_book,
    },
    bookingSettings: {
      enabled: data.bookingSettings?.enabled ?? true,
      requireConfirmation: data.bookingSettings?.require_confirmation ?? false,
      bufferMinutes: data.bookingSettings?.buffer_minutes ?? 15,
      maxAdvanceDays: data.bookingSettings?.max_advance_days ?? 30,
    },
    planMinutesRemaining: data.minutesRemaining,
    isMinutesExhausted: data.minutesExhausted,
  };
}

// =============================================================================
// Exports
// =============================================================================

export * from "./types";
export {
  buildEnglishPromptRequest,
  buildSpanishPromptRequest,
  generateMockEnglishPrompt,
  generateMockSpanishPrompt,
} from "./meta-prompt";
export {
  queuePromptRegeneration,
  triggerImmediateRegeneration,
  processRegenerationQueue,
  getTriggerType,
} from "./queue";
