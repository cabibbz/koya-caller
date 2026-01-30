/**
 * Koya Caller - Onboarding Types
 * Spec Reference: Part 5 (Lines 206-585)
 * Session 9: Steps 1-3
 */

import type { PriceType } from "@/types";

// ============================================
// Onboarding Step Definitions
// Spec Lines 211-214: Navigation
// ============================================

export const ONBOARDING_STEPS = [
  { step: 1, label: "Business Type", path: "/onboarding" },
  { step: 2, label: "Services", path: "/onboarding/services" },
  { step: 3, label: "FAQs", path: "/onboarding/faqs" },
  { step: 4, label: "Calendar", path: "/onboarding/calendar" },
  { step: 5, label: "Call Handling", path: "/onboarding/calls" },
  { step: 6, label: "Language", path: "/onboarding/language" },
  { step: 7, label: "Voice", path: "/onboarding/voice" },
  { step: 8, label: "Phone", path: "/onboarding/phone" },
  { step: 9, label: "Test", path: "/onboarding/test" },
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]["step"];

// ============================================
// Step 1: Business Type
// Spec Lines 216-220
// ============================================

export interface BusinessTypeOption {
  type_slug: string;
  type_name: string;
  sort_order: number;
}

export interface BusinessTemplate {
  id: string;
  type_slug: string;
  type_name: string;
  default_services: TemplateService[];
  default_faqs: TemplateFAQ[];
  urgency_triggers: string[];
  sort_order: number;
}

// ============================================
// Step 2: Services - Make It Yours
// Spec Lines 222-260
// ============================================

export interface TemplateService {
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number | null;
  price_type: PriceType;
  is_bookable: boolean;
}

export interface ServiceFormData {
  id?: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_cents: number | null;
  price_type: PriceType;
  is_bookable: boolean;
  isSelected: boolean;
  isCustom: boolean;
  sort_order: number;
}

// Spec Lines 241-244: Pricing Approach
export type PricingApproach = "specific" | "quote" | "hidden";

export const PRICING_APPROACH_OPTIONS = [
  { value: "specific" as const, label: "Mention specific prices" },
  { value: "quote" as const, label: "Say \"call for quote\" for everything" },
  { value: "hidden" as const, label: "Don't discuss pricing at all" },
] as const;

// Step 2 Form State
export interface Step2FormData {
  services: ServiceFormData[];
  pricingApproach: PricingApproach;
  serviceArea: string;
  differentiator: string;
  businessHours: BusinessHoursFormData[];
}

// Business Hours Form
export interface BusinessHoursFormData {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export const DEFAULT_BUSINESS_HOURS: BusinessHoursFormData[] = [
  { day_of_week: 0, open_time: "", close_time: "", is_closed: true }, // Sunday
  { day_of_week: 1, open_time: "09:00", close_time: "17:00", is_closed: false }, // Monday
  { day_of_week: 2, open_time: "09:00", close_time: "17:00", is_closed: false },
  { day_of_week: 3, open_time: "09:00", close_time: "17:00", is_closed: false },
  { day_of_week: 4, open_time: "09:00", close_time: "17:00", is_closed: false },
  { day_of_week: 5, open_time: "09:00", close_time: "17:00", is_closed: false }, // Friday
  { day_of_week: 6, open_time: "", close_time: "", is_closed: true }, // Saturday
];

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

// ============================================
// Step 3: FAQs & Knowledge
// Spec Lines 262-280
// ============================================

export interface TemplateFAQ {
  question: string;
  answer: string;
}

export interface FAQFormData {
  id?: string;
  question: string;
  answer: string;
  isSelected: boolean;
  isCustom: boolean;
  needsAttention?: boolean; // AI flagged
  sort_order: number;
}

export interface Step3FormData {
  faqs: FAQFormData[];
  additionalKnowledge: string;
  neverSay: string;
}

// ============================================
// Step 4: Calendar
// Spec Lines 283-320
// ============================================

export type CalendarProvider = "google" | "outlook" | "built_in";

export const CALENDAR_PROVIDER_OPTIONS = [
  {
    value: "google" as const,
    label: "Google Calendar",
    description: "Connect your Google account",
    icon: "google",
  },
  {
    value: "outlook" as const,
    label: "Microsoft Outlook",
    description: "Connect your Microsoft 365",
    icon: "microsoft",
  },
  {
    value: "built_in" as const,
    label: "Use Koya's Built-in Scheduler",
    description: "We'll manage availability based on your business hours. No external account needed.",
    icon: "calendar",
  },
] as const;

export const DURATION_OPTIONS = [
  { value: 30, label: "30 minutes" },
  { value: 60, label: "60 minutes" },
  { value: 90, label: "90 minutes" },
  { value: 0, label: "Custom" },
] as const;

export const BUFFER_OPTIONS = [
  { value: 0, label: "No buffer" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
] as const;

export const ADVANCE_BOOKING_OPTIONS = [
  { value: 7, label: "1 week" },
  { value: 14, label: "2 weeks" },
  { value: 30, label: "1 month" },
  { value: 90, label: "3 months" },
] as const;

export interface Step4FormData {
  provider: CalendarProvider;
  isConnected: boolean; // For Google/Outlook OAuth status
  calendarId: string | null; // Selected calendar ID after OAuth
  defaultDurationMinutes: number;
  customDurationMinutes: number | null; // When using custom duration
  bufferMinutes: number;
  advanceBookingDays: number;
  requireEmail: boolean;
}

export const DEFAULT_STEP4_DATA: Step4FormData = {
  provider: "built_in",
  isConnected: false,
  calendarId: null,
  defaultDurationMinutes: 60,
  customDurationMinutes: null,
  bufferMinutes: 0,
  advanceBookingDays: 14,
  requireEmail: false,
};

// ============================================
// Step 5: Call Handling
// Spec Lines 322-370
// ============================================

export type TransferHoursType = "always" | "business_hours" | "custom";

export const TRANSFER_HOURS_OPTIONS = [
  { value: "always" as const, label: "Always available for transfer" },
  { value: "business_hours" as const, label: "Only during business hours" },
  { value: "custom" as const, label: "Custom schedule" },
] as const;

export interface Step5FormData {
  // Transfer settings
  transferNumber: string;
  backupTransferNumber: string;
  
  // Transfer triggers
  transferOnRequest: boolean; // When caller asks for a human
  transferOnEmergency: boolean; // For emergencies
  transferOnUpset: boolean; // When caller seems upset
  transferKeywords: string; // Comma-separated custom keywords
  
  // Transfer hours
  transferHoursType: TransferHoursType;
  transferHoursCustom: BusinessHoursFormData[] | null;
  
  // After hours behavior
  afterHoursEnabled: boolean; // Koya still answers
  afterHoursCanBook: boolean; // Can book appointments after hours
  afterHoursMessageOnly: boolean; // Take message only mode
  afterHoursGreeting: string; // Custom after-hours greeting
}

export const DEFAULT_STEP5_DATA: Step5FormData = {
  transferNumber: "",
  backupTransferNumber: "",
  transferOnRequest: true,
  transferOnEmergency: true,
  transferOnUpset: false,
  transferKeywords: "",
  transferHoursType: "always",
  transferHoursCustom: null,
  afterHoursEnabled: true,
  afterHoursCanBook: true,
  afterHoursMessageOnly: false,
  afterHoursGreeting: "",
};

// ============================================
// Step 6: Language Settings
// Spec Lines 372-420
// ============================================

export type LanguageMode = "auto" | "ask" | "spanish_default";

export const LANGUAGE_MODE_OPTIONS = [
  {
    value: "auto" as const,
    label: "Auto-detect",
    description: "Koya listens to the caller and responds in their language (Recommended for mixed customer base)",
  },
  {
    value: "ask" as const,
    label: "Ask at start",
    description: '"For English, press 1. Para español, oprima 2." (Best if you want clear separation)',
  },
  {
    value: "spanish_default" as const,
    label: "Default to Spanish",
    description: "Koya greets in Spanish, switches to English if needed (Best if most callers speak Spanish)",
  },
] as const;

export interface Step6FormData {
  spanishEnabled: boolean;
  languageMode: LanguageMode;
  greetingSpanish: string;
  afterHoursGreetingSpanish: string;
}

export const DEFAULT_STEP6_DATA: Step6FormData = {
  spanishEnabled: false,
  languageMode: "auto",
  greetingSpanish: "",
  afterHoursGreetingSpanish: "",
};

// ============================================
// Step 7: Voice & Personality
// Spec Lines 396-416
// ============================================

export type VoiceGender = "male" | "female";
export type VoiceStyle = "warm" | "professional" | "energetic";
export type Personality = "professional" | "friendly" | "casual";

export interface VoiceSample {
  id: string;
  name: string;
  gender: VoiceGender;
  style: VoiceStyle;
  provider: "elevenlabs" | "openai";
  previewUrl: string; // Static audio sample URL
  retellVoiceId: string; // For later Retell integration
  supportsBilingual: boolean;
}

export const PERSONALITY_OPTIONS = [
  {
    value: "professional" as const,
    label: "Professional",
    description: "Businesslike and efficient",
  },
  {
    value: "friendly" as const,
    label: "Friendly",
    description: "Warm and conversational",
  },
  {
    value: "casual" as const,
    label: "Casual",
    description: "Relaxed and approachable",
  },
] as const;

export interface Step7FormData {
  voiceId: string;
  voiceIdSpanish: string | null;
  personality: Personality;
  greeting: string;
  greetingSpanish: string;
  aiName: string;
}

export const DEFAULT_STEP7_DATA: Step7FormData = {
  voiceId: "",
  voiceIdSpanish: null,
  personality: "professional",
  greeting: "",
  greetingSpanish: "",
  aiName: "Koya",
};

// ============================================
// Step 8: Phone Number Setup
// Spec Lines 418-520
// ============================================

export type PhoneSetupType = "new" | "forward";

export type PhoneProvider = 
  | "att" 
  | "verizon" 
  | "tmobile" 
  | "spectrum" 
  | "comcast" 
  | "voip" 
  | "other";

export const PHONE_PROVIDER_OPTIONS = [
  { value: "att" as const, label: "AT&T" },
  { value: "verizon" as const, label: "Verizon" },
  { value: "tmobile" as const, label: "T-Mobile" },
  { value: "spectrum" as const, label: "Spectrum Business" },
  { value: "comcast" as const, label: "Comcast Business" },
  { value: "voip" as const, label: "VoIP (RingCentral, Vonage, etc.)" },
  { value: "other" as const, label: "Other / I'm not sure" },
] as const;

export interface AvailablePhoneNumber {
  phoneNumber: string; // E.164 format: +14155551234
  friendlyName: string; // Formatted: (415) 555-1234
  locality: string; // City
  region: string; // State
}

export interface Step8FormData {
  setupType: PhoneSetupType | null;
  areaCode: string;
  availableNumbers: AvailablePhoneNumber[];
  selectedNumber: string | null;
  twilioSid: string | null;
  isProvisioned: boolean;
  
  // For forwarding setup
  forwardedFrom: string | null;
  carrier: PhoneProvider | null;
  forwardingConfirmed: boolean;
}

export const DEFAULT_STEP8_DATA: Step8FormData = {
  setupType: null,
  areaCode: "",
  availableNumbers: [],
  selectedNumber: null,
  twilioSid: null,
  isProvisioned: false,
  forwardedFrom: null,
  carrier: null,
  forwardingConfirmed: false,
};

// ============================================
// Step 9: Test Call (Completion)
// Spec Lines 522-557
// ============================================

export interface Step9Data {
  testCallMade: boolean;
  testCallSuccessful: boolean | null;
  readyToActivate: boolean;
}

export const DEFAULT_STEP9_DATA: Step9Data = {
  testCallMade: false,
  testCallSuccessful: null,
  readyToActivate: false,
};

// ============================================
// Overall Onboarding State
// ============================================

export interface OnboardingState {
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  businessId: string | null;
  
  // Step 1
  businessType: string | null;
  businessTypeName: string | null;
  templateLoaded: boolean;
  
  // Step 2
  step2Data: Step2FormData | null;
  
  // Step 3
  step3Data: Step3FormData | null;
  
  // Step 4
  step4Data: Step4FormData | null;
  
  // Step 5
  step5Data: Step5FormData | null;
  
  // Step 6
  step6Data: Step6FormData | null;
  
  // Step 7
  step7Data: Step7FormData | null;
  
  // Step 8
  step8Data: Step8FormData | null;
  
  // Loading states
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

export const INITIAL_ONBOARDING_STATE: OnboardingState = {
  currentStep: 1,
  completedSteps: [],
  businessId: null,
  businessType: null,
  businessTypeName: null,
  templateLoaded: false,
  step2Data: null,
  step3Data: null,
  step4Data: null,
  step5Data: null,
  step6Data: null,
  step7Data: null,
  step8Data: null,
  isLoading: false,
  isSaving: false,
  error: null,
};

// ============================================
// Action Types
// ============================================

export type OnboardingAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_SAVING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_BUSINESS_ID"; payload: string }
  | { type: "SET_CURRENT_STEP"; payload: OnboardingStep }
  | { type: "COMPLETE_STEP"; payload: OnboardingStep }
  | { type: "SET_BUSINESS_TYPE"; payload: { slug: string; name: string } }
  | { type: "SET_TEMPLATE_LOADED"; payload: boolean }
  | { type: "SET_STEP2_DATA"; payload: Step2FormData }
  | { type: "SET_STEP3_DATA"; payload: Step3FormData }
  | { type: "SET_STEP4_DATA"; payload: Step4FormData }
  | { type: "SET_STEP5_DATA"; payload: Step5FormData }
  | { type: "SET_STEP6_DATA"; payload: Step6FormData }
  | { type: "SET_STEP7_DATA"; payload: Step7FormData }
  | { type: "SET_STEP8_DATA"; payload: Step8FormData }
  | { type: "LOAD_SAVED_STATE"; payload: Partial<OnboardingState> };

// ============================================
// Utility Functions
// ============================================

export function templateServiceToFormData(
  service: TemplateService,
  index: number
): ServiceFormData {
  return {
    name: service.name,
    description: service.description,
    duration_minutes: service.duration_minutes,
    price_cents: service.price_cents,
    price_type: service.price_type,
    is_bookable: service.is_bookable,
    isSelected: true,
    isCustom: false,
    sort_order: index,
  };
}

export function templateFAQToFormData(
  faq: TemplateFAQ,
  index: number
): FAQFormData {
  return {
    question: faq.question,
    answer: faq.answer,
    isSelected: true,
    isCustom: false,
    needsAttention: false,
    sort_order: index,
  };
}

export function createEmptyService(sortOrder: number): ServiceFormData {
  return {
    name: "",
    description: "",
    duration_minutes: 60,
    price_cents: null,
    price_type: "quote",
    is_bookable: true,
    isSelected: true,
    isCustom: true,
    sort_order: sortOrder,
  };
}

export function createEmptyFAQ(sortOrder: number): FAQFormData {
  return {
    question: "",
    answer: "",
    isSelected: true,
    isCustom: true,
    needsAttention: false,
    sort_order: sortOrder,
  };
}

export function formatPrice(cents: number | null): string {
  if (cents === null) return "";
  if (cents === 0) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

export function parsePriceInput(value: string): number | null {
  if (!value || value === "") return null;
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return null;
  return Math.round(parsed * 100);
}
