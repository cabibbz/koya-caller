/**
 * Koya Caller - Claude API Types
 * Session 14: Claude API Integration
 * Spec Reference: Part 15, Lines 1758-1916
 */

// =============================================================================
// Input Types - Data sent to Claude for prompt generation
// =============================================================================

/**
 * Business context for prompt generation
 * Spec Reference: Lines 1851-1858
 */
export interface BusinessContext {
  name: string;
  type: string;
  address?: string;
  website?: string;
  serviceArea?: string;
  differentiator?: string;
  hours: BusinessHoursContext;
}

export interface BusinessHoursContext {
  monday?: { open: string; close: string } | null;
  tuesday?: { open: string; close: string } | null;
  wednesday?: { open: string; close: string } | null;
  thursday?: { open: string; close: string } | null;
  friday?: { open: string; close: string } | null;
  saturday?: { open: string; close: string } | null;
  sunday?: { open: string; close: string } | null;
  timezone: string;
}

/**
 * Service definition
 */
export interface ServiceContext {
  name: string;
  description?: string;
  duration_minutes: number;
  price?: number;
}

/**
 * FAQ definition
 */
export interface FAQContext {
  question: string;
  answer: string;
}

/**
 * AI configuration context
 * Spec Reference: Lines 1864-1869
 */
export interface AIConfigContext {
  name: string;
  personality: "professional" | "friendly" | "casual";
  greeting: string;
  greetingSpanish?: string;
}

/**
 * Language settings
 * Spec Reference: Lines 1870-1873
 */
export interface LanguageSettings {
  spanishEnabled: boolean;
  languageMode: "auto" | "ask" | "spanish_default";
}

/**
 * Call handling settings
 */
export interface CallSettings {
  transferEnabled: boolean;
  transferNumber?: string;
  transferOnRequest: boolean;
  transferOnEmergency: boolean;
  transferOnUpset: boolean;
  afterHoursEnabled: boolean;
  afterHoursCanBook: boolean;
}

/**
 * Booking settings
 */
export interface BookingSettings {
  enabled: boolean;
  requireConfirmation: boolean;
  bufferMinutes: number;
  maxAdvanceDays: number;
}

/**
 * Upsell offer context
 */
export interface UpsellContext {
  sourceServiceName: string;
  targetServiceName: string;
  discountPercent: number;
  pitchMessage?: string;
  triggerTiming: "before_booking" | "after_booking";
  suggestWhenUnavailable?: boolean;
}

/**
 * Bundle offer context - group multiple services together
 */
export interface BundleContext {
  name: string;
  serviceNames: string[];
  discountPercent: number;
  pitchMessage?: string;
}

/**
 * Package subscription context - multi-visit packages
 */
export interface PackageContext {
  name: string;
  serviceName?: string;
  sessionCount: number;
  discountPercent: number;
  pitchMessage?: string;
  minVisitsToPitch: number;
}

/**
 * Membership plan context
 */
export interface MembershipContext {
  name: string;
  pricePerMonth: number;
  billingPeriod: "monthly" | "quarterly" | "annual";
  benefits: string;
  pitchMessage?: string;
  pitchAfterBookingAmount?: number;
  pitchAfterVisitCount?: number;
}

/**
 * Complete input for prompt generation
 * Spec Reference: Lines 1848-1878
 */
export interface PromptGenerationInput {
  business: BusinessContext;
  services: ServiceContext[];
  faqs: FAQContext[];
  upsells?: UpsellContext[];
  bundles?: BundleContext[];
  packages?: PackageContext[];
  memberships?: MembershipContext[];
  additionalKnowledge?: string;
  neverSay?: string;
  aiConfig: AIConfigContext;
  languageSettings: LanguageSettings;
  callSettings: CallSettings;
  bookingSettings: BookingSettings;
  planMinutesRemaining: number;
  isMinutesExhausted: boolean;
}

// =============================================================================
// Output Types - Generated prompts
// =============================================================================

/**
 * Generated prompt output
 * Spec Reference: Lines 1881-1888
 */
export interface GeneratedPrompts {
  englishPrompt: string;
  spanishPrompt?: string;
  version: number;
  generatedAt: string;
  tokenCount: {
    english: number;
    spanish?: number;
  };
}

/**
 * Prompt generation result
 */
export interface PromptGenerationResult {
  success: boolean;
  prompts?: GeneratedPrompts;
  error?: string;
  mock?: boolean;
}

// =============================================================================
// Queue Types
// =============================================================================

/**
 * Regeneration trigger types
 * Spec Reference: Lines 1892-1898
 */
export type RegenerationTrigger =
  | "services_update"
  | "faqs_update"
  | "knowledge_update"
  | "settings_update"
  | "language_update"
  | "offer_settings_update";

/**
 * Queue item status
 */
export type QueueStatus = "pending" | "processing" | "completed" | "failed";

/**
 * Queue processing result
 */
export interface QueueProcessingResult {
  success: boolean;
  processed: number;
  failed: number;
  errors?: { businessId: string; error: string }[];
}

// =============================================================================
// API Response Types
// =============================================================================

export interface GeneratePromptResponse {
  success: boolean;
  prompts?: GeneratedPrompts;
  error?: string;
  mock?: boolean;
}

export interface ProcessQueueResponse {
  success: boolean;
  processed: number;
  failed: number;
  errors?: { businessId: string; error: string }[];
}

// =============================================================================
// Enhanced Prompt System Types
// =============================================================================

/**
 * Configuration for enhanced prompt features
 */
export interface EnhancedPromptConfig {
  /** Enable industry-specific prompt enhancements */
  industryEnhancements: boolean;
  /** Enable few-shot conversation examples in prompts */
  fewShotExamplesEnabled: boolean;
  /** Level of sentiment detection: none, basic, advanced */
  sentimentDetectionLevel: "none" | "basic" | "advanced";
  /** Enable caller context/recognition features */
  callerContextEnabled: boolean;
  /** Tone intensity: 1 (subdued) to 5 (expressive) */
  toneIntensity: 1 | 2 | 3 | 4 | 5;
  /** Enable personality-aware error messages */
  personalityAwareErrors: boolean;
  /** Maximum few-shot examples to include */
  maxFewShotExamples: number;
}

/**
 * Default enhanced prompt configuration
 */
export const DEFAULT_ENHANCED_PROMPT_CONFIG: EnhancedPromptConfig = {
  industryEnhancements: true,
  fewShotExamplesEnabled: true,
  sentimentDetectionLevel: "basic",
  callerContextEnabled: true,
  toneIntensity: 3,
  personalityAwareErrors: true,
  maxFewShotExamples: 3
};

/**
 * Extended AI configuration with enhanced features
 */
export interface ExtendedAIConfigContext extends AIConfigContext {
  promptConfig?: EnhancedPromptConfig;
}

/**
 * Industry-specific enhancement configuration
 */
export interface IndustryEnhancementConfig {
  displayName: string;
  personalityModifiers: Record<"professional" | "friendly" | "casual", string>;
  terminology: string[];
  commonPhrases: string[];
  scenarios: Array<{ trigger: string; instruction: string }>;
  guardrails: string[];
  urgencyKeywords: string[];
  typicalServices: string[];
  peakTimes?: string;
}

/**
 * Sentiment detection configuration
 */
export interface SentimentDetectionConfig {
  level: SentimentLevel;
  category: "positive" | "neutral" | "negative";
  escalationThreshold: number;
}

/**
 * Sentiment levels for caller emotion tracking
 */
export type SentimentLevel =
  | "pleased"
  | "neutral"
  | "confused"
  | "impatient"
  | "frustrated"
  | "upset"
  | "angry";

/**
 * Caller context for personalization
 */
export interface CallerContextData {
  isRepeatCaller: boolean;
  knownName: string | null;
  previousCallCount: number;
  lastCallOutcome: string | null;
  knownPreferences: Record<string, string>;
  appointmentHistory: {
    count: number;
    lastServiceBooked: string | null;
    lastAppointmentDate: string | null;
  };
}

/**
 * Few-shot conversation example
 */
export interface ConversationExample {
  category: string;
  personality: "professional" | "friendly" | "casual";
  context: string;
  conversation: Array<{
    role: "caller" | "ai";
    content: string;
  }>;
  notes?: string;
}

/**
 * Error template for personality-aware error handling
 */
export interface PersonalityErrorTemplate {
  initial: string;
  followUp: string;
  recovery: string;
}

/**
 * Complete prompt generation options including enhancements
 */
export interface EnhancedPromptGenerationInput extends PromptGenerationInput {
  enhancedConfig?: EnhancedPromptConfig;
  callerContext?: CallerContextData;
  industryType?: string;
}

/**
 * Result of enhanced prompt generation
 */
export interface EnhancedPromptGenerationResult extends PromptGenerationResult {
  enhancementsApplied?: {
    industry: boolean;
    fewShot: boolean;
    sentiment: boolean;
    callerContext: boolean;
    errorTemplates: boolean;
  };
}
