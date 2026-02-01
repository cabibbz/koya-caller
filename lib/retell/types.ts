/**
 * Koya Caller - Retell.ai Type Definitions
 * Session 13: Retell.ai Integration
 * Spec Reference: Part 11, Lines 1268-1526
 */

// ============================================
// Voice Configuration (Spec Lines 1277-1282)
// ============================================

export type VoiceProvider = "elevenlabs" | "openai";
export type VoiceGender = "male" | "female" | "neutral";

export interface VoiceOption {
  id: string;
  provider: VoiceProvider;
  gender: VoiceGender;
  name: string;
  description: string;
  isMultilingual: boolean;
}

// All voice IDs verified against Retell API as of 2026-01
export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: "11labs-Adrian",
    provider: "elevenlabs",
    gender: "male",
    name: "Adrian",
    description: "Professional, American male voice",
    isMultilingual: true,
  },
  {
    id: "11labs-Grace",
    provider: "elevenlabs",
    gender: "female",
    name: "Grace",
    description: "Warm, conversational female voice",
    isMultilingual: true,
  },
  {
    id: "openai-Alloy",
    provider: "openai",
    gender: "neutral",
    name: "Alloy",
    description: "Fast response, neutral voice",
    isMultilingual: false,
  },
  {
    id: "openai-Coral",
    provider: "openai",
    gender: "female",
    name: "Coral",
    description: "Natural conversation, female voice",
    isMultilingual: false,
  },
];

// ============================================
// Agent Configuration (Spec Lines 1284-1293)
// ============================================

export interface RetellAgentConfig {
  voiceId: string;
  voiceModel?: string;
  language?: "en" | "multi";
  backchannelWords?: string[];
  responseEngine: {
    type: "retell-llm";
    llmId: string;
  };
}

export interface CreateAgentRequest {
  businessId: string;
  voiceId: string;
  personality: "professional" | "friendly" | "casual";
  spanishEnabled: boolean;
  languageMode: "auto" | "ask" | "spanish_default";
  greeting: string;
  greetingSpanish?: string;
  systemPrompt: string;
  systemPromptSpanish?: string;
}

export interface CreateAgentResponse {
  agentId: string;
  llmId: string;
  agentIdSpanish?: string;
  llmIdSpanish?: string;
}

// ============================================
// WebRTC Calling (Spec Lines 1295-1330)
// ============================================

export interface CreateWebCallRequest {
  agentId: string;
  dynamicVariables?: Record<string, string>;
  metadata?: Record<string, string>;
}

export interface CreateWebCallResponse {
  accessToken: string;
  callId: string;
}

// ============================================
// Dynamic Variables (Spec Lines 1332-1356)
// ============================================

export interface DynamicVariables {
  business_name: string;
  ai_name: string;
  minutes_exhausted: "true" | "false";
  after_hours: "true" | "false";
  can_book: "true" | "false";
  transfer_enabled: "true" | "false";
  spanish_enabled: "true" | "false";
  language_mode: "auto" | "ask" | "spanish_default";
  current_services: string;
  current_faqs: string;
  business_hours: string;
  today_date: string;
  current_time: string;
}

// Built-in Retell variables (auto-populated)
export interface RetellSystemVariables {
  current_time: string;
  session_duration: string;
  direction: "inbound" | "outbound";
  user_number: string;
  call_id: string;
}

// ============================================
// Webhook Events (Spec Lines 1358-1377)
// ============================================

export type WebhookEventType = "call_started" | "call_ended" | "call_analyzed";

export interface WebhookEvent {
  event: WebhookEventType;
  call_id: string;
  agent_id: string;
  metadata?: Record<string, string>;
}

export interface CallStartedEvent extends WebhookEvent {
  event: "call_started";
  from_number?: string;
  to_number?: string;
  direction: "inbound" | "outbound";
  start_timestamp: number;
}

export interface TranscriptMessage {
  role: "agent" | "user";
  content: string;
  timestamp: number;
}

export interface CallEndedEvent extends WebhookEvent {
  event: "call_ended";
  duration_ms: number;
  end_timestamp: number;
  transcript: TranscriptMessage[];
  recording_url?: string;
  disconnection_reason?: string;
  user_sentiment?: string;
  call_summary?: string;
  custom_analysis?: Record<string, unknown>;
}

export interface CallAnalyzedEvent extends WebhookEvent {
  event: "call_analyzed";
  call_summary: string;
  user_sentiment: "positive" | "neutral" | "negative";
  call_successful: boolean;
  custom_analysis?: Record<string, unknown>;
}

// ============================================
// Function Calls (Spec Lines 1396-1450)
// ============================================

export type FunctionName =
  | "check_availability"
  | "book_appointment"
  | "transfer_call"
  | "take_message"
  | "send_sms"
  | "end_call";

export interface FunctionParameter {
  type: "string" | "number" | "boolean";
  description: string;
  enum?: string[];
  required?: boolean;
}

export interface FunctionDefinition {
  name: FunctionName;
  description: string;
  parameters: Record<string, FunctionParameter>;
}

export interface CheckAvailabilityArgs {
  date: string;
  service?: string;
}

export interface BookAppointmentArgs {
  date: string;
  time: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  service: string;
  notes?: string;
}

export interface TransferCallArgs {
  reason: string;
}

export interface TakeMessageArgs {
  caller_name: string;
  caller_phone: string;
  message: string;
  urgency: "low" | "normal" | "high" | "emergency";
}

export interface SendSmsArgs {
  message: string;
}

export interface EndCallArgs {
  reason: string;
}

export type FunctionArgs =
  | CheckAvailabilityArgs
  | BookAppointmentArgs
  | TransferCallArgs
  | TakeMessageArgs
  | SendSmsArgs
  | EndCallArgs;

export interface FunctionCallRequest {
  function_name: FunctionName;
  arguments: Record<string, unknown>;
  call_id: string;
  agent_id: string;
  metadata?: Record<string, string>;
}

export interface FunctionCallResponse {
  success: boolean;
  result?: string;
  data?: Record<string, unknown>;
  error?: string;
}

// ============================================
// Agent Management Types (Used by lib/retell/index.ts)
// ============================================

export interface AgentCreateParams {
  voiceId: string;
  language: "en" | "es" | "multi";
  personality: "professional" | "friendly" | "casual";
  businessName: string;
  aiName: string;
  greeting: string;
  greetingSpanish?: string;
  systemPrompt: string;
  systemPromptSpanish?: string;
  spanishEnabled: boolean;
  languageMode: "auto" | "ask" | "spanish_default";
  // Voice control settings
  voiceTemperature?: number; // 0-2, default 1.0 (stability vs expressiveness)
  voiceSpeed?: number; // 0.5-2, default 1.0 (speech rate)
  voiceVolume?: number; // 0-2, default 1.0 (loudness)
  beginMessageDelayMs?: number; // 0-5000, default 0 (delay before first message)
}

export interface AgentResponse {
  agent_id: string;
  llm_id: string;
  voice_id: string;
  language: string;
  created_at: string;
}

export interface WebCallParams {
  agentId: string;
  dynamicVariables?: Record<string, string>;
  metadata?: Record<string, string>;
}

export interface WebCallResponse {
  access_token: string;
  call_id: string;
  agent_id: string;
}

export interface PhoneCallRegisterParams {
  agentId: string;
  fromNumber: string;
  toNumber: string;
  dynamicVariables?: Record<string, string>;
  metadata?: Record<string, string>;
}

export interface PhoneCallResponse {
  call_id: string;
  agent_id: string;
  call_type: string;
}

// ============================================
// Retell LLM Configuration
// ============================================

export interface RetellLLMConfig {
  model: string;
  general_prompt: string;
  general_tools: FunctionDefinition[];
  begin_message?: string;
  inbound_dynamic_variables_webhook_url?: string;
}

export interface RetellAgentCreateParams {
  llm_websocket_url?: string;
  response_engine: {
    type: "retell-llm";
    llm_id: string;
  };
  voice_id: string;
  voice_model?: string;
  language?: string;
  backchannel_words?: string[];
  agent_name?: string;
  ambient_sound?: string;
  enable_backchannel?: boolean;
  interruption_sensitivity?: number;
  voice_speed?: number;
  voice_temperature?: number;
  volume?: number;
  responsiveness?: number;
  webhook_url?: string;
  begin_message_delay_ms?: number;
}

export interface RetellAgent {
  agent_id: string;
  agent_name?: string;
  voice_id: string;
  response_engine: {
    type: string;
    llm_id?: string;
  };
  created_at: string;
  last_modified_at: string;
}

export interface RetellLLM {
  llm_id: string;
  model: string;
  general_prompt: string;
  created_at: string;
  last_modified_at: string;
}

// ============================================
// Phone Call Types
// ============================================

export interface RegisterPhoneCallParams {
  agent_id: string;
  from_number: string;
  to_number: string;
  retell_llm_dynamic_variables?: Record<string, string>;
  metadata?: Record<string, string>;
}

export interface RegisterPhoneCallResponse {
  call_id: string;
  agent_id: string;
  call_type: string;
  from_number: string;
  to_number: string;
  direction: string;
  call_status: string;
}

// ============================================
// Error Types
// ============================================

export class RetellError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retellCode?: string
  ) {
    super(message);
    this.name = "RetellError";
  }
}

export class RetellConfigError extends RetellError {
  constructor(message: string) {
    super(message);
    this.name = "RetellConfigError";
  }
}

export class RetellAPIError extends RetellError {
  constructor(message: string, statusCode?: number, retellCode?: string) {
    super(message, statusCode, retellCode);
    this.name = "RetellAPIError";
  }
}
