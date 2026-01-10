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
 * Complete input for prompt generation
 * Spec Reference: Lines 1848-1878
 */
export interface PromptGenerationInput {
  business: BusinessContext;
  services: ServiceContext[];
  faqs: FAQContext[];
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
  | "language_update";

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
