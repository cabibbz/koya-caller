/**
 * Koya Caller - Type Definitions
 * Based on Spec Part 9: Database Schema (Lines 852-1178)
 */

// ============================================
// Pricing Plans (Spec Lines 18-24, 863-874)
// ============================================

export type PlanSlug = "starter" | "professional" | "business";

export interface Plan {
  id: string;
  slug: PlanSlug;
  name: string;
  price_cents: number;
  included_minutes: number;
  features: string[];
  stripe_price_id: string | null;
  sort_order: number;
  is_active: boolean;
}

// Spec Part 1, Lines 18-24: Pricing tiers
export const PLANS: Record<PlanSlug, { price: number; minutes: number; calls: number }> = {
  starter: { price: 99, minutes: 200, calls: 40 },
  professional: { price: 197, minutes: 800, calls: 160 },
  business: { price: 397, minutes: 2000, calls: 400 },
};

// ============================================
// Users & Businesses (Spec Lines 856-907)
// ============================================

export interface User {
  id: string;
  email: string;
  phone: string | null;
  created_at: string;
}

export type SubscriptionStatus = "onboarding" | "active" | "paused" | "cancelled";

export interface Business {
  id: string;
  user_id: string;
  name: string;
  business_type: string | null;
  address: string | null;
  website: string | null;
  service_area: string | null;
  differentiator: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
  onboarding_step: number;
  onboarding_completed_at: string | null;
  subscription_status: SubscriptionStatus;
  plan_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_cycle_start: string | null;
  current_cycle_end: string | null;
  minutes_used_this_cycle: number;
  minutes_included: number;
  last_usage_alert_percent: number;
}

// ============================================
// Business Hours (Spec Lines 909-918)
// ============================================

export interface BusinessHours {
  id: string;
  business_id: string;
  day_of_week: number; // 0=Sunday
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

// ============================================
// Services (Spec Lines 920-935)
// ============================================

export type PriceType = "fixed" | "quote" | "hidden";

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number | null;
  price_type: PriceType;
  is_bookable: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// FAQs (Spec Lines 937-948)
// ============================================

export interface FAQ {
  id: string;
  business_id: string;
  question: string;
  answer: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// Knowledge (Spec Lines 950-958)
// ============================================

export interface Knowledge {
  id: string;
  business_id: string;
  content: string | null;
  never_say: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// AI Config (Spec Lines 960-987)
// ============================================

export type Personality = "professional" | "friendly" | "casual";
export type LanguageMode = "auto" | "ask" | "spanish_default";

export interface AIConfig {
  id: string;
  business_id: string;
  voice_id: string | null;
  voice_id_spanish: string | null;
  ai_name: string;
  personality: Personality;
  greeting: string | null;
  greeting_spanish: string | null;
  after_hours_greeting: string | null;
  after_hours_greeting_spanish: string | null;
  minutes_exhausted_greeting: string | null;
  minutes_exhausted_greeting_spanish: string | null;
  spanish_enabled: boolean;
  language_mode: LanguageMode;
  system_prompt: string | null;
  system_prompt_spanish: string | null;
  system_prompt_version: number;
  system_prompt_generated_at: string | null;
  retell_agent_id: string | null;
  retell_agent_id_spanish: string | null;
  retell_agent_version: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// Call Settings (Spec Lines 989-1010)
// ============================================

export type TransferHoursType = "always" | "business_hours" | "custom";
export type AfterHoursAction = "voicemail" | "ai" | "transfer";

export interface CallSettings {
  id: string;
  business_id: string;
  transfer_number: string | null;
  backup_transfer_number: string | null;
  transfer_on_request: boolean;
  transfer_on_emergency: boolean;
  transfer_on_upset: boolean;
  transfer_keywords: string[];
  transfer_hours_type: TransferHoursType;
  transfer_hours_custom: Record<string, unknown> | null;
  no_answer_action: string;
  no_answer_timeout_seconds: number;
  after_hours_enabled: boolean;
  after_hours_can_book: boolean;
  after_hours_message_only: boolean;
  after_hours_action: AfterHoursAction;
  max_call_duration_seconds: number;
  recording_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Calendar Integration (Spec Lines 1012-1038)
// ============================================

export type CalendarProvider = "google" | "outlook" | "built_in";

export interface CalendarIntegration {
  id: string;
  business_id: string;
  provider: CalendarProvider;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  calendar_id: string | null;
  default_duration_minutes: number;
  buffer_minutes: number;
  advance_booking_days: number;
  require_email: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// Phone Numbers (Spec Lines 1040-1055)
// ============================================

export type PhoneSetupType = "direct" | "forwarded";

export interface PhoneNumber {
  id: string;
  business_id: string;
  number: string;
  twilio_sid: string | null;
  setup_type: PhoneSetupType;
  forwarded_from: string | null;
  carrier: string | null;
  is_active: boolean;
  created_at: string;
}

// ============================================
// Calls (Spec Lines 1056-1082)
// ============================================

export type CallOutcome = 
  | "booked" 
  | "transferred" 
  | "info" 
  | "message" 
  | "missed" 
  | "minutes_exhausted";

export type CallLanguage = "en" | "es";

export interface Call {
  id: string;
  business_id: string;
  retell_call_id: string | null;
  from_number: string | null;
  to_number: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  duration_minutes_billed: number | null;
  language: CallLanguage;
  recording_url: string | null;
  transcript: Record<string, unknown> | null;
  summary: string | null;
  outcome: CallOutcome | null;
  lead_info: Record<string, unknown> | null;
  message_taken: string | null;
  cost_cents: number | null;
  flagged: boolean;
  notes: string | null;
  created_at: string;
}

// ============================================
// Appointments (Spec Lines 1084-1107)
// ============================================

export type AppointmentStatus = "confirmed" | "cancelled" | "completed" | "no_show";

export interface Appointment {
  id: string;
  business_id: string;
  call_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  service_id: string | null;
  service_name: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  status: AppointmentStatus;
  notes: string | null;
  external_event_id: string | null;
  confirmation_sent_at: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// SMS Messages (Spec Lines 1109-1127)
// ============================================

export type SMSDirection = "inbound" | "outbound";
export type SMSMessageType = 
  | "booking_confirmation" 
  | "reminder" 
  | "message_alert" 
  | "usage_alert" 
  | "transfer_alert";
export type SMSStatus = "sent" | "delivered" | "failed";

export interface SMSMessage {
  id: string;
  business_id: string;
  call_id: string | null;
  appointment_id: string | null;
  direction: SMSDirection;
  message_type: SMSMessageType;
  from_number: string | null;
  to_number: string | null;
  body: string | null;
  twilio_sid: string | null;
  status: SMSStatus;
  sent_at: string;
}

// ============================================
// Notification Settings (Spec Lines 1128-1141)
// ============================================

export type ReminderSetting = "off" | "1hr" | "24hr";

export interface NotificationSettings {
  id: string;
  business_id: string;
  sms_all_calls: boolean;
  sms_bookings: boolean;
  sms_missed: boolean;
  sms_messages: boolean;
  sms_usage_alerts: boolean;
  email_daily: boolean;
  email_weekly: boolean;
  sms_customer_confirmation: boolean;
  sms_customer_reminder: ReminderSetting;
}

// ============================================
// Business Templates (Spec Lines 1143-1152)
// ============================================

export interface BusinessTemplate {
  id: string;
  type_slug: string;
  type_name: string;
  default_services: Service[];
  default_faqs: FAQ[];
  urgency_triggers: string[];
  sort_order: number;
}

// ============================================
// Demo Leads (Spec Lines 1154-1164)
// ============================================

export interface DemoLead {
  id: string;
  email: string;
  demo_started_at: string;
  demo_completed: boolean;
  converted_to_signup: boolean;
  converted_at: string | null;
}

// ============================================
// Prompt Regeneration Queue (Spec Lines 1166-1178)
// ============================================

export type PromptTrigger = 
  | "services_update" 
  | "faqs_update" 
  | "knowledge_update" 
  | "settings_update" 
  | "language_update";

export type QueueStatus = "pending" | "processing" | "completed" | "failed";

export interface PromptRegenerationQueue {
  id: string;
  business_id: string;
  triggered_by: PromptTrigger;
  status: QueueStatus;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

// ============================================
// Usage Alerts (Spec Part 6, Lines 609-613)
// ============================================

export type UsageAlertLevel = 50 | 80 | 95 | 100;

export const USAGE_ALERT_MESSAGES: Record<UsageAlertLevel, string> = {
  50: "Koya update: You've used {used} of your {total} minutes this month. You're on track!",
  80: "Heads up: You've used {used} of {total} minutes. Consider upgrading to avoid interruption.",
  95: "⚠️ Almost out! {used}/{total} minutes used. Upgrade now to keep Koya answering.",
  100: "Koya is now taking messages only. Upgrade to restore full service.",
};

// Re-export Supabase database types
export * from "./supabase";
