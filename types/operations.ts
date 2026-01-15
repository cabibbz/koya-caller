/**
 * Koya Caller - Operations Tables Type Definitions
 * Session 3: Database Schema (Operations Tables)
 * Spec Reference: Part 9, Lines 937-1054
 * 
 * This file contains Insert and Update types for operations tables.
 * Row types are defined in types/index.ts
 */

import type {
  FAQ,
  Knowledge,
  AIConfig,
  CallSettings,
  CalendarIntegration,
  PhoneNumber,
} from './index';

// =============================================================================
// FAQ Types (Spec Lines 937-948)
// =============================================================================

export type { FAQ };

export interface FAQInsert {
  id?: string;
  business_id: string;
  question: string;
  answer: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface FAQUpdate {
  question?: string;
  answer?: string;
  sort_order?: number;
  updated_at?: string;
}

// =============================================================================
// Knowledge Types (Spec Lines 950-958)
// =============================================================================

export type { Knowledge };

export interface KnowledgeInsert {
  id?: string;
  business_id: string;
  content?: string | null;
  never_say?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface KnowledgeUpdate {
  content?: string | null;
  never_say?: string | null;
  updated_at?: string;
}

// =============================================================================
// AI Config Types (Spec Lines 960-987)
// =============================================================================

export type { AIConfig };

export interface AIConfigInsert {
  id?: string;
  business_id: string;
  voice_id?: string | null;
  voice_id_spanish?: string | null;
  ai_name?: string;
  personality?: string;
  greeting?: string | null;
  greeting_spanish?: string | null;
  after_hours_greeting?: string | null;
  after_hours_greeting_spanish?: string | null;
  minutes_exhausted_greeting?: string | null;
  minutes_exhausted_greeting_spanish?: string | null;
  spanish_enabled?: boolean;
  language_mode?: string;
  system_prompt?: string | null;
  system_prompt_spanish?: string | null;
  system_prompt_version?: number;
  system_prompt_generated_at?: string | null;
  retell_agent_id?: string | null;
  retell_agent_id_spanish?: string | null;
  retell_agent_version?: number;
  created_at?: string;
  updated_at?: string;
}

export interface AIConfigUpdate {
  voice_id?: string | null;
  voice_id_spanish?: string | null;
  ai_name?: string;
  personality?: string;
  greeting?: string | null;
  greeting_spanish?: string | null;
  after_hours_greeting?: string | null;
  after_hours_greeting_spanish?: string | null;
  minutes_exhausted_greeting?: string | null;
  minutes_exhausted_greeting_spanish?: string | null;
  spanish_enabled?: boolean;
  language_mode?: string;
  system_prompt?: string | null;
  system_prompt_spanish?: string | null;
  system_prompt_version?: number;
  system_prompt_generated_at?: string | null;
  retell_agent_id?: string | null;
  retell_agent_id_spanish?: string | null;
  retell_agent_version?: number;
  updated_at?: string;
}

// =============================================================================
// Call Settings Types (Spec Lines 989-1010)
// =============================================================================

export type { CallSettings };

export interface CallSettingsInsert {
  id?: string;
  business_id: string;
  transfer_number?: string | null;
  backup_transfer_number?: string | null;
  transfer_on_request?: boolean;
  transfer_on_emergency?: boolean;
  transfer_on_upset?: boolean;
  transfer_keywords?: string[];
  transfer_hours_type?: string;
  transfer_hours_custom?: Record<string, unknown> | null;
  no_answer_action?: string;
  no_answer_timeout_seconds?: number;
  after_hours_enabled?: boolean;
  after_hours_can_book?: boolean;
  after_hours_message_only?: boolean;
  max_call_duration_seconds?: number;
  recording_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CallSettingsUpdate {
  transfer_number?: string | null;
  backup_transfer_number?: string | null;
  transfer_on_request?: boolean;
  transfer_on_emergency?: boolean;
  transfer_on_upset?: boolean;
  transfer_keywords?: string[];
  transfer_hours_type?: string;
  transfer_hours_custom?: Record<string, unknown> | null;
  no_answer_action?: string;
  no_answer_timeout_seconds?: number;
  after_hours_enabled?: boolean;
  after_hours_can_book?: boolean;
  after_hours_message_only?: boolean;
  max_call_duration_seconds?: number;
  recording_enabled?: boolean;
  updated_at?: string;
}

// =============================================================================
// Calendar Integration Types (Spec Lines 1012-1027)
// =============================================================================

export type { CalendarIntegration };

export interface CalendarIntegrationInsert {
  id?: string;
  business_id: string;
  provider: 'google' | 'outlook' | 'built_in';
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  calendar_id?: string | null;
  default_duration_minutes?: number;
  buffer_minutes?: number;
  advance_booking_days?: number;
  require_email?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CalendarIntegrationUpdate {
  provider?: 'google' | 'outlook' | 'built_in';
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  calendar_id?: string | null;
  default_duration_minutes?: number;
  buffer_minutes?: number;
  advance_booking_days?: number;
  require_email?: boolean;
  updated_at?: string;
}

// =============================================================================
// Availability Slot Types (Spec Lines 1029-1038)
// =============================================================================

export interface AvailabilitySlot {
  id: string;
  business_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface AvailabilitySlotInsert {
  id?: string;
  business_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface AvailabilitySlotUpdate {
  day_of_week?: number;
  start_time?: string;
  end_time?: string;
}

// =============================================================================
// Phone Number Types (Spec Lines 1040-1054)
// =============================================================================

export type { PhoneNumber };

export interface PhoneNumberInsert {
  id?: string;
  business_id: string;
  number: string;
  twilio_sid?: string | null;
  setup_type?: 'direct' | 'forwarded';
  forwarded_from?: string | null;
  carrier?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export interface PhoneNumberUpdate {
  number?: string;
  twilio_sid?: string | null;
  setup_type?: 'direct' | 'forwarded';
  forwarded_from?: string | null;
  carrier?: string | null;
  is_active?: boolean;
}
