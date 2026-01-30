/**
 * Test Data Factories
 *
 * Factory functions for creating consistent test data across tests.
 * Uses builder pattern for flexible data generation.
 */

import type {
  User,
  Business,
  Call,
  Appointment,
  Service,
  FAQ,
  Knowledge,
  AIConfig,
  CallSettings,
  BusinessHours,
  Plan,
  CallOutcome,
  CallLanguage,
  AppointmentStatus,
  SubscriptionStatus,
  Personality,
  LanguageMode,
  PriceType,
  TransferHoursType,
  AfterHoursAction,
} from "@/types";
import type { MockUser } from "./mock-supabase";

// =============================================================================
// ID Generator
// =============================================================================

let idCounter = 0;

/**
 * Generates a unique ID for test data
 */
export function generateId(prefix = "test"): string {
  idCounter++;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

/**
 * Resets the ID counter (call in beforeEach)
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

// =============================================================================
// User Factory
// =============================================================================

export interface UserFactoryOptions {
  id?: string;
  email?: string;
  phone?: string | null;
  tenantId?: string;
  isAdmin?: boolean;
}

export function createMockUser(options: UserFactoryOptions = {}): MockUser {
  const id = options.id || generateId("user");
  return {
    id,
    email: options.email || `user-${id}@test.com`,
    phone: options.phone ?? null,
    app_metadata: {
      tenant_id: options.tenantId,
      is_admin: options.isAdmin ?? false,
    },
    user_metadata: {},
  };
}

export function createUser(options: Partial<User> = {}): User {
  const id = options.id || generateId("user");
  return {
    id,
    email: options.email || `user-${id}@test.com`,
    phone: options.phone ?? null,
    created_at: options.created_at || new Date().toISOString(),
  };
}

// =============================================================================
// Business Factory
// =============================================================================

export interface BusinessFactoryOptions extends Partial<Business> {
  userId?: string;
  planId?: string;
}

export function createBusiness(options: BusinessFactoryOptions = {}): Business {
  const id = options.id || generateId("business");
  const now = new Date().toISOString();

  return {
    id,
    user_id: options.userId || options.user_id || generateId("user"),
    name: options.name || `Test Business ${id}`,
    business_type: options.business_type ?? "service",
    industry: options.industry ?? "general",
    address: options.address ?? "123 Test St, Test City, TS 12345",
    website: options.website ?? "https://test.example.com",
    service_area: options.service_area ?? "Test City Metro Area",
    differentiator: options.differentiator ?? "Best test service in town",
    timezone: options.timezone || "America/New_York",
    created_at: options.created_at || now,
    updated_at: options.updated_at || now,
    onboarding_step: options.onboarding_step ?? 9,
    onboarding_completed_at: options.onboarding_completed_at ?? now,
    subscription_status: options.subscription_status || "active",
    plan_id: options.planId || options.plan_id || null,
    stripe_customer_id: options.stripe_customer_id ?? null,
    stripe_subscription_id: options.stripe_subscription_id ?? null,
    current_cycle_start: options.current_cycle_start ?? now.split("T")[0],
    current_cycle_end:
      options.current_cycle_end ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    minutes_used_this_cycle: options.minutes_used_this_cycle ?? 50,
    minutes_included: options.minutes_included ?? 200,
    last_usage_alert_percent: options.last_usage_alert_percent ?? 0,
    trial_ends_at: options.trial_ends_at ?? null,
    trial_minutes_limit: options.trial_minutes_limit ?? null,
    trial_minutes_used: options.trial_minutes_used ?? null,
    trial_email_3day_sent: options.trial_email_3day_sent ?? null,
    trial_email_1day_sent: options.trial_email_1day_sent ?? null,
    trial_email_expired_sent: options.trial_email_expired_sent ?? null,
  };
}

// =============================================================================
// Call Factory
// =============================================================================

export interface CallFactoryOptions extends Partial<Call> {
  businessId?: string;
}

export function createCall(options: CallFactoryOptions = {}): Call {
  const id = options.id || generateId("call");
  const now = new Date();
  const startedAt = options.started_at || new Date(now.getTime() - 300000).toISOString();
  const endedAt = options.ended_at || now.toISOString();

  return {
    id,
    business_id: options.businessId || options.business_id || generateId("business"),
    retell_call_id: options.retell_call_id ?? `retell-${id}`,
    from_number: options.from_number ?? "+15551234567",
    to_number: options.to_number ?? "+15559876543",
    direction: options.direction ?? "inbound",
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: options.duration_seconds ?? 180,
    duration_minutes_billed: options.duration_minutes_billed ?? 3,
    language: options.language || "en",
    recording_url: options.recording_url ?? `https://storage.example.com/recordings/${id}.mp3`,
    transcript: options.transcript ?? {
      utterances: [
        { role: "agent", content: "Hello, thank you for calling." },
        { role: "user", content: "Hi, I'd like to book an appointment." },
      ],
    },
    summary: options.summary ?? "Customer called to book an appointment for next week.",
    outcome: options.outcome ?? "booked",
    lead_info: options.lead_info ?? {
      name: "John Doe",
      email: "john@example.com",
    },
    message_taken: options.message_taken ?? null,
    cost_cents: options.cost_cents ?? 15,
    flagged: options.flagged ?? false,
    notes: options.notes ?? null,
    sentiment_detected: options.sentiment_detected ?? "neutral",
    error_recovery_used: options.error_recovery_used ?? false,
    created_at: options.created_at || now.toISOString(),
  };
}

/**
 * Creates multiple calls with different outcomes for testing
 */
export function createCallsWithVariedOutcomes(
  businessId: string,
  count: number = 10
): Call[] {
  const outcomes: CallOutcome[] = ["booked", "transferred", "info", "message", "missed"];
  const languages: CallLanguage[] = ["en", "es"];

  return Array.from({ length: count }, (_, i) => {
    const daysAgo = Math.floor(i / 2);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    return createCall({
      businessId,
      outcome: outcomes[i % outcomes.length],
      language: languages[i % languages.length],
      created_at: createdAt.toISOString(),
      started_at: new Date(createdAt.getTime() - 300000).toISOString(),
      ended_at: createdAt.toISOString(),
      duration_seconds: 60 + Math.floor(Math.random() * 240),
    });
  });
}

// =============================================================================
// Appointment Factory
// =============================================================================

export interface AppointmentFactoryOptions extends Partial<Appointment> {
  businessId?: string;
  callId?: string;
}

export function createAppointment(options: AppointmentFactoryOptions = {}): Appointment {
  const id = options.id || generateId("appointment");
  const now = new Date();
  const scheduledAt =
    options.scheduled_at ||
    new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  return {
    id,
    business_id: options.businessId || options.business_id || generateId("business"),
    call_id: options.callId || options.call_id || null,
    customer_name: options.customer_name ?? "Jane Doe",
    customer_phone: options.customer_phone ?? "+15551234567",
    customer_email: options.customer_email ?? "jane@example.com",
    service_id: options.service_id ?? null,
    service_name: options.service_name ?? "General Consultation",
    scheduled_at: scheduledAt,
    duration_minutes: options.duration_minutes ?? 60,
    status: options.status || "confirmed",
    notes: options.notes ?? null,
    external_event_id: options.external_event_id ?? null,
    confirmation_sent_at: options.confirmation_sent_at ?? null,
    reminder_sent_at: options.reminder_sent_at ?? null,
    reminder_1hr_sent_at: options.reminder_1hr_sent_at ?? null,
    reminder_24hr_sent_at: options.reminder_24hr_sent_at ?? null,
    created_at: options.created_at || now.toISOString(),
    updated_at: options.updated_at || now.toISOString(),
  };
}

// =============================================================================
// Service Factory
// =============================================================================

export interface ServiceFactoryOptions extends Partial<Service> {
  businessId?: string;
}

export function createService(options: ServiceFactoryOptions = {}): Service {
  const id = options.id || generateId("service");
  const now = new Date().toISOString();

  return {
    id,
    business_id: options.businessId || options.business_id || generateId("business"),
    name: options.name || `Test Service ${id}`,
    description: options.description ?? "A test service description",
    duration_minutes: options.duration_minutes ?? 60,
    price_cents: options.price_cents ?? 5000,
    price_type: options.price_type || "fixed",
    is_bookable: options.is_bookable ?? true,
    sort_order: options.sort_order ?? 0,
    created_at: options.created_at || now,
    updated_at: options.updated_at || now,
  };
}

// =============================================================================
// FAQ Factory
// =============================================================================

export interface FAQFactoryOptions extends Partial<FAQ> {
  businessId?: string;
}

export function createFAQ(options: FAQFactoryOptions = {}): FAQ {
  const id = options.id || generateId("faq");
  const now = new Date().toISOString();

  return {
    id,
    business_id: options.businessId || options.business_id || generateId("business"),
    question: options.question || "What are your hours?",
    answer: options.answer || "We are open Monday through Friday, 9 AM to 5 PM.",
    sort_order: options.sort_order ?? 0,
    created_at: options.created_at || now,
    updated_at: options.updated_at || now,
  };
}

// =============================================================================
// Plan Factory
// =============================================================================

export function createPlan(options: Partial<Plan> = {}): Plan {
  const id = options.id || generateId("plan");

  return {
    id,
    slug: options.slug || "professional",
    name: options.name || "Professional",
    price_cents: options.price_cents ?? 19700,
    included_minutes: options.included_minutes ?? 800,
    features: options.features || ["Feature 1", "Feature 2", "Feature 3"],
    stripe_price_id: options.stripe_price_id ?? `price_${id}`,
    sort_order: options.sort_order ?? 1,
    is_active: options.is_active ?? true,
  };
}

// =============================================================================
// Knowledge Factory
// =============================================================================

export interface KnowledgeFactoryOptions extends Partial<Knowledge> {
  businessId?: string;
}

export function createKnowledge(options: KnowledgeFactoryOptions = {}): Knowledge {
  const id = options.id || generateId("knowledge");
  const now = new Date().toISOString();

  return {
    id,
    business_id: options.businessId || options.business_id || generateId("business"),
    content:
      options.content ??
      "This is the knowledge base content for the AI assistant.",
    never_say: options.never_say ?? "Never mention competitor names.",
    created_at: options.created_at || now,
    updated_at: options.updated_at || now,
  };
}

// =============================================================================
// AI Config Factory
// =============================================================================

export interface AIConfigFactoryOptions extends Partial<AIConfig> {
  businessId?: string;
}

export function createAIConfig(options: AIConfigFactoryOptions = {}): AIConfig {
  const id = options.id || generateId("ai-config");
  const now = new Date().toISOString();

  return {
    id,
    business_id: options.businessId || options.business_id || generateId("business"),
    voice_id: options.voice_id ?? "eleven_labs_voice_1",
    voice_id_spanish: options.voice_id_spanish ?? "eleven_labs_voice_es_1",
    ai_name: options.ai_name || "Alex",
    personality: options.personality || "friendly",
    greeting: options.greeting ?? "Hello! Thank you for calling. How can I help you today?",
    greeting_spanish:
      options.greeting_spanish ?? "Hola! Gracias por llamar. Como puedo ayudarle hoy?",
    after_hours_greeting: options.after_hours_greeting ?? null,
    after_hours_greeting_spanish: options.after_hours_greeting_spanish ?? null,
    minutes_exhausted_greeting: options.minutes_exhausted_greeting ?? null,
    minutes_exhausted_greeting_spanish: options.minutes_exhausted_greeting_spanish ?? null,
    spanish_enabled: options.spanish_enabled ?? true,
    language_mode: options.language_mode || "auto",
    system_prompt: options.system_prompt ?? null,
    system_prompt_spanish: options.system_prompt_spanish ?? null,
    system_prompt_version: options.system_prompt_version ?? 1,
    system_prompt_generated_at: options.system_prompt_generated_at ?? null,
    retell_agent_id: options.retell_agent_id ?? null,
    retell_agent_id_spanish: options.retell_agent_id_spanish ?? null,
    retell_agent_version: options.retell_agent_version ?? 1,
    prompt_config: options.prompt_config ?? null,
    upsells_enabled: options.upsells_enabled ?? false,
    bundles_enabled: options.bundles_enabled ?? false,
    packages_enabled: options.packages_enabled ?? false,
    memberships_enabled: options.memberships_enabled ?? false,
    boosted_keywords: options.boosted_keywords || [],
    analysis_summary_prompt: options.analysis_summary_prompt ?? null,
    analysis_model: options.analysis_model || "gpt-4.1-mini",
    fallback_voice_ids: options.fallback_voice_ids || [],
    voice_temperature: options.voice_temperature ?? 1.0,
    voice_speed: options.voice_speed ?? 1.0,
    voice_volume: options.voice_volume ?? 0,
    begin_message_delay_ms: options.begin_message_delay_ms ?? 1000,
    created_at: options.created_at || now,
    updated_at: options.updated_at || now,
  };
}

// =============================================================================
// Call Settings Factory
// =============================================================================

export interface CallSettingsFactoryOptions extends Partial<CallSettings> {
  businessId?: string;
}

export function createCallSettings(options: CallSettingsFactoryOptions = {}): CallSettings {
  const id = options.id || generateId("call-settings");
  const now = new Date().toISOString();

  return {
    id,
    business_id: options.businessId || options.business_id || generateId("business"),
    transfer_number: options.transfer_number ?? "+15551234567",
    backup_transfer_number: options.backup_transfer_number ?? null,
    transfer_on_request: options.transfer_on_request ?? true,
    transfer_on_emergency: options.transfer_on_emergency ?? true,
    transfer_on_upset: options.transfer_on_upset ?? true,
    transfer_keywords: options.transfer_keywords || ["speak to human", "real person"],
    transfer_hours_type: options.transfer_hours_type || "business_hours",
    transfer_hours_custom: options.transfer_hours_custom ?? null,
    no_answer_action: options.no_answer_action || "voicemail",
    no_answer_timeout_seconds: options.no_answer_timeout_seconds ?? 30,
    after_hours_enabled: options.after_hours_enabled ?? true,
    after_hours_can_book: options.after_hours_can_book ?? true,
    after_hours_message_only: options.after_hours_message_only ?? false,
    after_hours_action: options.after_hours_action || "ai",
    max_call_duration_seconds: options.max_call_duration_seconds ?? 900,
    recording_enabled: options.recording_enabled ?? true,
    voicemail_detection_enabled: options.voicemail_detection_enabled ?? true,
    voicemail_message: options.voicemail_message ?? null,
    voicemail_detection_timeout_ms: options.voicemail_detection_timeout_ms ?? 30000,
    reminder_trigger_ms: options.reminder_trigger_ms ?? 10000,
    reminder_max_count: options.reminder_max_count ?? 1,
    end_call_after_silence_ms: options.end_call_after_silence_ms ?? 600000,
    dtmf_enabled: options.dtmf_enabled ?? false,
    dtmf_digit_limit: options.dtmf_digit_limit ?? 10,
    dtmf_termination_key: options.dtmf_termination_key || "#",
    dtmf_timeout_ms: options.dtmf_timeout_ms ?? 5000,
    denoising_mode: options.denoising_mode || "noise-cancellation",
    pii_redaction_enabled: options.pii_redaction_enabled ?? false,
    pii_categories: options.pii_categories || [],
    interruption_sensitivity: options.interruption_sensitivity ?? 1.0,
    responsiveness: options.responsiveness ?? 1.0,
    created_at: options.created_at || now,
    updated_at: options.updated_at || now,
  };
}

// =============================================================================
// Business Hours Factory
// =============================================================================

export interface BusinessHoursFactoryOptions extends Partial<BusinessHours> {
  businessId?: string;
}

export function createBusinessHours(
  options: BusinessHoursFactoryOptions = {}
): BusinessHours {
  const id = options.id || generateId("business-hours");

  return {
    id,
    business_id: options.businessId || options.business_id || generateId("business"),
    day_of_week: options.day_of_week ?? 1, // Monday
    open_time: options.open_time ?? "09:00",
    close_time: options.close_time ?? "17:00",
    is_closed: options.is_closed ?? false,
  };
}

/**
 * Creates a full week of business hours
 */
export function createWeeklyBusinessHours(businessId: string): BusinessHours[] {
  return [
    createBusinessHours({ businessId, day_of_week: 0, is_closed: true, open_time: null, close_time: null }),
    createBusinessHours({ businessId, day_of_week: 1 }),
    createBusinessHours({ businessId, day_of_week: 2 }),
    createBusinessHours({ businessId, day_of_week: 3 }),
    createBusinessHours({ businessId, day_of_week: 4 }),
    createBusinessHours({ businessId, day_of_week: 5 }),
    createBusinessHours({ businessId, day_of_week: 6, is_closed: true, open_time: null, close_time: null }),
  ];
}

// =============================================================================
// Complete Test Scenario Factory
// =============================================================================

export interface TestScenarioData {
  user: MockUser;
  business: Business;
  calls: Call[];
  appointments: Appointment[];
  services: Service[];
  faqs: FAQ[];
}

/**
 * Creates a complete test scenario with related entities
 */
export function createTestScenario(options: {
  callCount?: number;
  appointmentCount?: number;
  serviceCount?: number;
  faqCount?: number;
} = {}): TestScenarioData {
  const {
    callCount = 5,
    appointmentCount = 3,
    serviceCount = 3,
    faqCount = 5,
  } = options;

  const user = createMockUser();
  const business = createBusiness({ userId: user.id });

  const services = Array.from({ length: serviceCount }, (_, i) =>
    createService({ businessId: business.id, sort_order: i })
  );

  const calls = createCallsWithVariedOutcomes(business.id, callCount);

  const appointments = Array.from({ length: appointmentCount }, (_, i) =>
    createAppointment({
      businessId: business.id,
      callId: calls[i]?.id,
      service_id: services[i % services.length]?.id,
      service_name: services[i % services.length]?.name,
    })
  );

  const faqs = Array.from({ length: faqCount }, (_, i) =>
    createFAQ({
      businessId: business.id,
      question: `FAQ Question ${i + 1}?`,
      answer: `This is the answer to FAQ ${i + 1}.`,
      sort_order: i,
    })
  );

  return {
    user,
    business,
    calls,
    appointments,
    services,
    faqs,
  };
}

// =============================================================================
// Export All
// =============================================================================

export const factories = {
  user: createUser,
  mockUser: createMockUser,
  business: createBusiness,
  call: createCall,
  appointment: createAppointment,
  service: createService,
  faq: createFAQ,
  plan: createPlan,
  knowledge: createKnowledge,
  aiConfig: createAIConfig,
  callSettings: createCallSettings,
  businessHours: createBusinessHours,
  weeklyBusinessHours: createWeeklyBusinessHours,
  callsWithVariedOutcomes: createCallsWithVariedOutcomes,
  testScenario: createTestScenario,
};
