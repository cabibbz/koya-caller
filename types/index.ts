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

export type SubscriptionStatus = "onboarding" | "trialing" | "trial_expired" | "active" | "paused" | "cancelled";

export interface Business {
  id: string;
  user_id: string;
  name: string;
  business_type: string | null;
  industry: string | null;
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
  // Trial period fields (migration 20250121000001)
  trial_ends_at: string | null;
  trial_minutes_limit: number | null;
  trial_minutes_used: number | null;
  trial_email_3day_sent: boolean | null;
  trial_email_1day_sent: boolean | null;
  trial_email_expired_sent: boolean | null;
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
export type AnalysisModel = "gpt-4.1-mini" | "claude-4.5-sonnet" | "gemini-2.5-flash";

// Prompt configuration for enhanced AI features
export interface PromptConfig {
  industryEnhancements: boolean;
  fewShotExamplesEnabled: boolean;
  sentimentDetectionLevel: "none" | "basic" | "advanced";
  callerContextEnabled: boolean;
  toneIntensity: number;
  personalityAwareErrors: boolean;
  maxFewShotExamples: number;
}

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
  // Enhanced prompt system (migration 20250110000001)
  prompt_config: PromptConfig | null;
  // Upselling feature flags (migrations 20250111000001, 20250112000001)
  upsells_enabled: boolean;
  bundles_enabled: boolean;
  packages_enabled: boolean;
  memberships_enabled: boolean;
  // Retell advanced features (migration 20250114000001)
  boosted_keywords: string[];
  analysis_summary_prompt: string | null;
  analysis_model: AnalysisModel;
  fallback_voice_ids: string[];
  // Voice control settings (migration 20250115000001)
  voice_temperature: number;
  voice_speed: number;
  voice_volume: number;
  begin_message_delay_ms: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// Call Settings (Spec Lines 989-1010)
// ============================================

export type TransferHoursType = "always" | "business_hours" | "custom";
export type AfterHoursAction = "voicemail" | "ai" | "transfer";
export type DenoisingMode = "noise-cancellation" | "noise-and-background-speech-cancellation";
export type DTMFTerminationKey = "#" | "*" | "none";
export type PIICategory = "ssn" | "credit_card" | "phone_number" | "email" | "date_of_birth" | "address";

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
  // Retell advanced features (migration 20250114000001)
  voicemail_detection_enabled: boolean;
  voicemail_message: string | null;
  voicemail_detection_timeout_ms: number;
  reminder_trigger_ms: number;
  reminder_max_count: number;
  end_call_after_silence_ms: number;
  dtmf_enabled: boolean;
  dtmf_digit_limit: number;
  dtmf_termination_key: DTMFTerminationKey;
  dtmf_timeout_ms: number;
  denoising_mode: DenoisingMode;
  pii_redaction_enabled: boolean;
  pii_categories: PIICategory[];
  // Responsiveness settings (migration 20250114000002)
  interruption_sensitivity: number;
  responsiveness: number;
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
  grant_id?: string | null;
  grant_email?: string | null;
  grant_provider?: string | null;
  grant_status?: string | null;
  nylas_calendar_id?: string | null;
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

// Sentiment detected during call (migration 20250110000001)
export type CallSentiment = "pleased" | "neutral" | "frustrated" | "upset" | "angry";

export interface Call {
  id: string;
  business_id: string;
  retell_call_id: string | null;
  from_number: string | null;
  to_number: string | null;
  direction: "inbound" | "outbound" | null;
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
  // Enhanced prompt system (migration 20250110000001)
  sentiment_detected: CallSentiment | null;
  error_recovery_used: boolean;
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
  reminder_1hr_sent_at: string | null;
  reminder_24hr_sent_at: string | null;
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

export type ReminderSetting = "off" | "1hr" | "24hr" | "both";

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
  email_missed: boolean;
  sms_customer_confirmation: boolean;
  sms_customer_reminder: ReminderSetting;
}

// ============================================
// SMS Templates (Customizable notification messages)
// ============================================

export interface SMSTemplates {
  id: string;
  business_id: string;
  // Customer-facing
  booking_confirmation: string | null;
  reminder_24hr: string | null;
  reminder_1hr: string | null;
  // Owner-facing
  missed_call_alert: string | null;
  message_alert: string | null;
  transfer_alert: string | null;
}

// Available template variables
export type SMSTemplateVariables = {
  // Customer templates
  business_name?: string;
  service_name?: string;
  date_time?: string;
  customer_name?: string;
  // Owner templates
  caller_name?: string;
  caller_phone?: string;
  call_time?: string;
  message?: string;
  reason?: string;
};

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

// ============================================
// Caller Profiles (migration 20250110000001)
// Repeat caller recognition
// ============================================

export type CallerTier = "new" | "returning" | "vip";

export interface CallerProfile {
  id: string;
  business_id: string;
  phone_number: string;
  name: string | null;
  email: string | null;
  notes: string | null;
  vip_status: boolean;
  preferences: Record<string, unknown>;
  call_count: number;
  last_call_at: string;
  last_outcome: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallerInsights {
  business_id: string;
  phone_number: string;
  name: string | null;
  call_count: number;
  last_call_at: string;
  last_outcome: string | null;
  preferences: Record<string, unknown>;
  caller_tier: CallerTier;
  appointment_count: number;
  last_service_booked: string | null;
}

// ============================================
// Upsells (migration 20250111000001)
// Service upgrade offers
// ============================================

export type UpsellTiming = "before_booking" | "after_booking";

export interface Upsell {
  id: string;
  business_id: string;
  source_service_id: string;
  target_service_id: string;
  discount_percent: number;
  pitch_message: string | null;
  trigger_timing: UpsellTiming;
  suggest_when_unavailable: boolean;
  is_active: boolean;
  times_offered: number;
  times_accepted: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// Bundles (migration 20250112000001)
// Service packages with discounts
// ============================================

export interface Bundle {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  discount_percent: number;
  pitch_message: string | null;
  is_active: boolean;
  times_offered: number;
  times_accepted: number;
  created_at: string;
  updated_at: string;
}

export interface BundleService {
  id: string;
  bundle_id: string;
  service_id: string;
  sort_order: number;
}

// ============================================
// Packages (migration 20250112000001)
// Multi-visit packages
// ============================================

export interface Package {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  service_id: string | null;
  session_count: number;
  discount_percent: number;
  price_cents: number | null;
  validity_days: number | null;
  pitch_message: string | null;
  min_visits_to_pitch: number;
  is_active: boolean;
  times_offered: number;
  times_accepted: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// Memberships (migration 20250112000001)
// Recurring membership plans
// ============================================

export type BillingPeriod = "monthly" | "quarterly" | "annual";

export interface Membership {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  billing_period: BillingPeriod;
  benefits: string;
  pitch_message: string | null;
  pitch_after_booking_amount_cents: number | null;
  pitch_after_visit_count: number | null;
  is_active: boolean;
  times_offered: number;
  times_accepted: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// Site Settings (migration 20241229000001)
// Configurable landing page settings
// ============================================

export type SiteSettingsCategory = "stats" | "pricing" | "general";

export interface SiteSetting {
  id: string;
  key: string;
  value: Record<string, unknown>;
  category: SiteSettingsCategory;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

// ============================================
// Blog Posts (migration 20241229000003)
// AI auto-generated blog content
// ============================================

export type BlogPostStatus = "draft" | "scheduled" | "published" | "archived";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  target_keyword: string | null;
  lsi_keywords: string[] | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  category: string | null;
  tags: string[] | null;
  status: BlogPostStatus;
  published_at: string | null;
  scheduled_for: string | null;
  generation_config: Record<string, unknown>;
  view_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BlogQueueStatus = "pending" | "generating" | "completed" | "failed";

export interface BlogGenerationQueue {
  id: string;
  topic: string;
  target_keyword: string | null;
  config: Record<string, unknown>;
  status: BlogQueueStatus;
  error_message: string | null;
  blog_post_id: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface BlogPreset {
  id: string;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
}

// ============================================
// Data Requests - GDPR/CCPA Compliance
// ============================================

export type DataRequestType = "export" | "deletion";
export type DataRequestStatus = "pending" | "processing" | "completed" | "cancelled";

export interface DataRequest {
  id: string;
  user_id: string;
  business_id: string;
  request_type: DataRequestType;
  status: DataRequestStatus;
  grace_period_ends_at: string | null;
  processed_at: string | null;
  feedback_reason: string | null;
  export_file_path: string | null;
  export_expires_at: string | null;
  created_at: string;
}

// ============================================
// Webhooks
// ============================================

export type WebhookEventType =
  | "call.started"
  | "call.ended"
  | "appointment.created"
  | "appointment.updated"
  | "appointment.cancelled";

export type WebhookDeliveryStatus = "pending" | "success" | "failed" | "retrying";

export interface Webhook {
  id: string;
  business_id: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_code: number | null;
  response_body: string | null;
  attempts: number;
  max_attempts: number;
  last_attempt_at: string;
  next_retry_at: string | null;
  status: WebhookDeliveryStatus;
  error_message: string | null;
  created_at: string;
}

// ============================================
// Blocked Dates (migration 20250122000002)
// Holiday/vacation blocking
// ============================================

export interface BlockedDate {
  id: string;
  business_id: string;
  blocked_date: string;
  reason: string | null;
  is_recurring: boolean;
  created_at: string;
}

// ============================================
// Service Availability (migration 20250122000002)
// Per-service availability overrides
// ============================================

export interface ServiceAvailability {
  id: string;
  service_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
  use_business_hours: boolean;
}

// ============================================
// Phase 3: Outbound Calling Types
// ============================================

export interface OutboundSettings {
  reminderCallsEnabled: boolean;
  reminderCall24hr: boolean;
  reminderCall2hr: boolean;
  reminderCallAgentId: string | null;
  reminderCallFromNumber: string | null;
  outboundDailyLimit: number;
  outboundHoursStart: string; // "09:00"
  outboundHoursEnd: string; // "18:00"
  outboundTimezone: string;
}

export type OutboundCampaignType = 'appointment_reminder' | 'follow_up' | 'marketing' | 'custom';
export type OutboundCampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';

export interface OutboundCampaign {
  id: string;
  businessId: string;
  name: string;
  type: OutboundCampaignType;
  status: OutboundCampaignStatus;
  agentId: string | null;
  fromNumber: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
}

export type OutboundQueueStatus = 'pending' | 'scheduled' | 'calling' | 'completed' | 'failed' | 'cancelled' | 'dnc_blocked';

export interface OutboundQueueItem {
  id: string;
  businessId: string;
  campaignId: string | null;
  appointmentId: string | null;
  contactPhone: string;
  contactName: string | null;
  dynamicVariables: Record<string, string>;
  priority: number;
  status: OutboundQueueStatus;
  scheduledFor: string | null;
  attemptCount: number;
  maxAttempts: number;
  lastAttemptAt: string | null;
  lastError: string | null;
  callId: string | null;
  retellCallId: string | null;
  outcome: string | null;
  createdAt: string;
}

export type DNCReason = 'customer_request' | 'complaint' | 'legal' | 'bounced' | 'other';

export interface DNCEntry {
  id: string;
  businessId: string;
  phoneNumber: string;
  reason: DNCReason;
  source: string | null;
  notes: string | null;
  addedBy: string | null;
  expiresAt: string | null;
  createdAt: string;
}

// ============================================
// Phase 3: Stripe Connect / Payment Types
// ============================================

export type StripeAccountType = 'standard' | 'express' | 'custom';
export type DepositType = 'fixed' | 'percentage' | 'full';
export type PayoutSchedule = 'daily' | 'weekly' | 'monthly' | 'manual';

export type PaymentStatus =
  | 'pending' | 'requires_payment_method' | 'requires_confirmation'
  | 'processing' | 'succeeded' | 'failed' | 'cancelled'
  | 'refunded' | 'partially_refunded';

export type PaymentType = 'deposit' | 'balance' | 'full' | 'refund';

export interface StripeConnectAccount {
  id: string;
  businessId: string;
  stripeAccountId: string;
  accountType: StripeAccountType;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
  businessName: string | null;
  defaultCurrency: string;
  country: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PaymentSettings {
  businessId: string;
  depositsEnabled: boolean;
  depositAmountCents: number | null;
  depositPercentage: number | null;
  depositType: DepositType;
  collectPaymentOnCall: boolean;
  requireCardOnFile: boolean;
  stripeConnectAccountId: string | null;
  applicationFeePercent: number;
  payoutSchedule: PayoutSchedule;
}

export interface PaymentTransaction {
  id: string;
  businessId: string;
  appointmentId: string | null;
  callId: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  amountCents: number;
  currency: string;
  applicationFeeCents: number | null;
  status: PaymentStatus;
  paymentType: PaymentType;
  description: string | null;
  failureReason: string | null;
  refundedAmountCents: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ============================================
// Phase 3: Extended Call Type with PHI Fields
// ============================================

export type CallDirection = 'inbound' | 'outbound';
export type CallType = 'phone' | 'web' | 'reminder' | 'campaign';

// ============================================
// Phase 3: Extended Appointment Type with Payment Fields
// ============================================

export interface AppointmentWithPayment extends Appointment {
  depositRequired: boolean;
  depositAmountCents: number | null;
  depositPaidAt: string | null;
  depositTransactionId: string | null;
  balanceAmountCents: number | null;
  balancePaidAt: string | null;
  balanceTransactionId: string | null;
}

// ============================================
// Phase 3: API Request/Response Types
// ============================================

// Outbound Calling API Types
export interface CreateOutboundCampaignRequest {
  name: string;
  type: OutboundCampaignType;
  agentId?: string;
  fromNumber?: string;
  scheduledAt?: string;
  settings?: Record<string, unknown>;
}

export interface QueueOutboundCallRequest {
  campaignId?: string;
  appointmentId?: string;
  contactPhone: string;
  contactName?: string;
  dynamicVariables?: Record<string, string>;
  priority?: number;
  scheduledFor?: string;
  maxAttempts?: number;
}

export interface AddToDNCRequest {
  phoneNumber: string;
  reason: DNCReason;
  source?: string;
  notes?: string;
  expiresAt?: string;
}

// Payment API Types
export interface CreateStripeConnectRequest {
  accountType?: StripeAccountType;
  businessName?: string;
  country?: string;
}

export interface CreateStripeConnectResponse {
  accountId: string;
  onboardingUrl: string;
}

export interface UpdatePaymentSettingsRequest {
  depositsEnabled?: boolean;
  depositAmountCents?: number;
  depositPercentage?: number;
  depositType?: DepositType;
  collectPaymentOnCall?: boolean;
  requireCardOnFile?: boolean;
  payoutSchedule?: PayoutSchedule;
}

export interface CreatePaymentIntentRequest {
  appointmentId?: string;
  callId?: string;
  customerPhone?: string;
  customerEmail?: string;
  amountCents: number;
  paymentType: PaymentType;
  description?: string;
}

export interface CreatePaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  transactionId: string;
}

export interface RefundPaymentRequest {
  transactionId: string;
  amountCents?: number; // Partial refund, omit for full refund
  reason?: string;
}

// ============================================
// Phase 3: Webhook Event Types
// ============================================

export type Phase3WebhookEventType =
  | 'outbound_call.started'
  | 'outbound_call.completed'
  | 'outbound_call.failed'
  | 'campaign.started'
  | 'campaign.completed'
  | 'campaign.paused'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.refunded'
  | 'consent.recorded'
  | 'consent.revoked'
  | 'phi.accessed';

export interface OutboundCallWebhookPayload {
  queueItemId: string;
  campaignId: string | null;
  contactPhone: string;
  contactName: string | null;
  callId: string | null;
  retellCallId: string | null;
  outcome: string | null;
  attemptCount: number;
  timestamp: string;
}

export interface PaymentWebhookPayload {
  transactionId: string;
  appointmentId: string | null;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  paymentType: PaymentType;
  stripePaymentIntentId: string | null;
  timestamp: string;
}

// ============================================
// Phase 3: Utility Types
// ============================================

export function isAppointmentWithPayment(
  appointment: Appointment | AppointmentWithPayment
): appointment is AppointmentWithPayment {
  return 'depositRequired' in appointment;
}

// Campaign statistics type
export interface CampaignStats {
  totalQueued: number;
  pending: number;
  completed: number;
  failed: number;
  cancelled: number;
  dncBlocked: number;
  successRate: number;
  avgAttempts: number;
}

// Payment summary type
export interface PaymentSummary {
  businessId: string;
  period: 'day' | 'week' | 'month' | 'year';
  periodStart: string;
  periodEnd: string;
  totalTransactions: number;
  totalAmountCents: number;
  totalFeeCents: number;
  successfulPayments: number;
  failedPayments: number;
  refundedAmountCents: number;
  depositCount: number;
  balancePaymentCount: number;
}

// Re-export Supabase database types
export * from "./supabase";
