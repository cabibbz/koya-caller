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
  EnhancedPromptConfig,
  EnhancedPromptGenerationResult,
} from "./types";
import { DEFAULT_ENHANCED_PROMPT_CONFIG } from "./types";
import {
  buildEnglishPromptRequest,
  buildSpanishPromptRequest,
  buildLanguageSwitchingInstructions,
  generateMockEnglishPrompt,
  generateMockSpanishPrompt,
  buildEnhancedEnglishPromptRequest,
  buildEnhancedSpanishPromptRequest,
} from "./meta-prompt";
import {
  withRetry,
  isClaudeRetryable,
} from "@/lib/errors";
import { logWarning } from "@/lib/logging";

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
    logWarning("Claude Mock", "ANTHROPIC_API_KEY not configured - using generic mock prompts. AI responses will be basic.");
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
  upsells?: Array<{
    source_service?: { name: string } | null;
    target_service?: { name: string } | null;
    discount_percent: number;
    pitch_message?: string | null;
    trigger_timing: string;
    suggest_when_unavailable?: boolean;
  }>;
  bundles?: Array<{
    name: string;
    discount_percent: number;
    pitch_message?: string | null;
    services: Array<{ name: string }>;
  }>;
  packages?: Array<{
    name: string;
    session_count: number;
    discount_percent: number;
    pitch_message?: string | null;
    min_visits_to_pitch: number;
    service?: { name: string } | null;
  }>;
  memberships?: Array<{
    name: string;
    price_cents: number;
    billing_period: string;
    benefits: string;
    pitch_message?: string | null;
    pitch_after_booking_amount_cents?: number | null;
    pitch_after_visit_count?: number | null;
  }>;
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
    upsells: data.upsells?.filter(u => u.source_service?.name && u.target_service?.name).map((u) => ({
      sourceServiceName: u.source_service!.name,
      targetServiceName: u.target_service!.name,
      discountPercent: u.discount_percent,
      pitchMessage: u.pitch_message || undefined,
      triggerTiming: (u.trigger_timing || "before_booking") as "before_booking" | "after_booking",
      suggestWhenUnavailable: u.suggest_when_unavailable || false,
    })),
    bundles: data.bundles?.map((b) => ({
      name: b.name,
      serviceNames: b.services.map(s => s.name),
      discountPercent: b.discount_percent,
      pitchMessage: b.pitch_message || undefined,
    })),
    packages: data.packages?.map((p) => ({
      name: p.name,
      serviceName: p.service?.name,
      sessionCount: p.session_count,
      discountPercent: p.discount_percent,
      pitchMessage: p.pitch_message || undefined,
      minVisitsToPitch: p.min_visits_to_pitch,
    })),
    memberships: data.memberships?.map((m) => {
      // Normalize to monthly price in cents first (integer math), then convert to dollars
      // Using Math.round to avoid floating-point precision issues
      const monthlyPriceCents = m.billing_period === "annual"
        ? Math.round(m.price_cents / 12)
        : m.billing_period === "quarterly"
          ? Math.round(m.price_cents / 3)
          : m.price_cents;
      return {
        name: m.name,
        // Use toFixed to ensure consistent decimal representation
        pricePerMonth: Number((monthlyPriceCents / 100).toFixed(2)),
        billingPeriod: m.billing_period as "monthly" | "quarterly" | "annual",
        benefits: m.benefits,
        pitchMessage: m.pitch_message || undefined,
        pitchAfterBookingAmount: m.pitch_after_booking_amount_cents
          ? Number((m.pitch_after_booking_amount_cents / 100).toFixed(2))
          : undefined,
        pitchAfterVisitCount: m.pitch_after_visit_count || undefined,
      };
    }),
    planMinutesRemaining: data.minutesRemaining,
    isMinutesExhausted: data.minutesExhausted,
  };
}

// =============================================================================
// Enhanced Prompt Generation
// =============================================================================

/**
 * Generate enhanced system prompts with industry-specific content,
 * sentiment detection, few-shot examples, and caller context support.
 *
 * @param input - Business context and configuration
 * @param enhancedConfig - Optional enhanced prompt configuration
 * @returns Generated prompts with enhancement metadata
 */
export async function generateEnhancedPrompts(
  input: PromptGenerationInput,
  enhancedConfig?: EnhancedPromptConfig
): Promise<EnhancedPromptGenerationResult> {
  const config = enhancedConfig || DEFAULT_ENHANCED_PROMPT_CONFIG;
  const client = getClient();

  // Mock mode if no API key
  if (!client) {
    logWarning("Claude Mock", "ANTHROPIC_API_KEY not configured - using generic mock prompts with no enhancements.");
    const mockResult = generateMockPrompts(input);
    return {
      ...mockResult,
      enhancementsApplied: {
        industry: false,
        fewShot: false,
        sentiment: false,
        callerContext: false,
        errorTemplates: false,
      },
    };
  }

  try {
    // Generate enhanced English prompt
    const englishPrompt = await generateEnhancedEnglishPrompt(client, input, config);

    // Generate enhanced Spanish prompt if enabled
    let spanishPrompt: string | undefined;
    if (input.languageSettings.spanishEnabled) {
      spanishPrompt = await generateEnhancedSpanishPrompt(client, input, config);
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
      mock: false,
      enhancementsApplied: {
        industry: config.industryEnhancements,
        fewShot: config.fewShotExamplesEnabled,
        sentiment: config.sentimentDetectionLevel !== "none",
        callerContext: config.callerContextEnabled,
        errorTemplates: config.personalityAwareErrors,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      mock: false,
      enhancementsApplied: {
        industry: false,
        fewShot: false,
        sentiment: false,
        callerContext: false,
        errorTemplates: false,
      },
    };
  }
}

/**
 * Generate enhanced English system prompt
 */
async function generateEnhancedEnglishPrompt(
  client: Anthropic,
  input: PromptGenerationInput,
  config: EnhancedPromptConfig
): Promise<string> {
  const metaPrompt = buildEnhancedEnglishPromptRequest(input, config);

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

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return textBlock.text;
}

/**
 * Generate enhanced Spanish system prompt
 */
async function generateEnhancedSpanishPrompt(
  client: Anthropic,
  input: PromptGenerationInput,
  config: EnhancedPromptConfig
): Promise<string> {
  const metaPrompt = buildEnhancedSpanishPromptRequest(input, config);

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

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return textBlock.text;
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
  buildEnhancedEnglishPromptRequest,
  buildEnhancedSpanishPromptRequest,
} from "./meta-prompt";
export {
  queuePromptRegeneration,
  triggerImmediateRegeneration,
  processRegenerationQueue,
  getTriggerType,
} from "./queue";

// Enhanced prompt system exports
export {
  getErrorMessage,
  getErrorInitial,
  getErrorFollowUp,
  getErrorRecovery,
  getFullErrorResponse,
  formatErrorMessage,
  getAllErrorTemplatesForPersonality,
  generateErrorHandlingInstructions,
  ERROR_TEMPLATES,
  ERROR_TEMPLATES_SPANISH,
  type Personality,
  type ErrorType,
  type ErrorMessage,
  type ErrorTemplate,
} from "./error-templates";

export {
  getIndustryEnhancement,
  getPersonalityModifier,
  getUrgencyKeywords,
  containsUrgencyKeyword,
  generateIndustryContextSection,
  getIndustryOptions,
  INDUSTRY_ENHANCEMENTS,
  type IndustryType,
  type IndustryScenario,
  type IndustryPromptEnhancement,
} from "./industry-prompts";

export {
  getSentimentConfig,
  getSentimentResponse,
  shouldConsiderEscalation,
  getSentimentCategory,
  generateSentimentInstructions,
  getAcknowledgment,
  detectSentimentLevel,
  getNegativeSentimentLevels,
  getSentimentHandlingSummary,
  SENTIMENT_INDICATORS,
  ESCALATION_TRIGGERS,
  type SentimentLevel as SentimentLevelType,
  type SentimentCategory,
  type SentimentIndicator,
  type SentimentResponse,
  type SentimentConfig,
  type EscalationTrigger,
} from "./sentiment-responses";

export {
  getExamplesByCategory,
  getExamplesByPersonality,
  getExamplesByIndustry,
  getRelevantExamples,
  formatExamplesForPrompt,
  getEssentialExamples,
  getScenarioCategories,
  FEW_SHOT_EXAMPLES,
  FEW_SHOT_EXAMPLES_SPANISH,
  type ScenarioCategory,
  type ConversationTurn,
  type FewShotExample,
} from "./few-shot-examples";

export {
  fetchCallerContext,
  updateCallerProfile,
  incrementCallerCallCount,
  buildCallerContextPrompt,
  buildCallerContextDynamicVars,
  isVIPCaller,
  getPersonalizedGreeting,
  getSuggestedFollowUp,
  shouldAskForName,
  type CallerPreferences,
  type CallerHistory,
  type CallerContext,
  type CallerProfile,
  type CallerContextDynamicVars,
} from "./caller-context";
