// =============================================================================
// Koya Caller - Operations Tables Database Helpers
// Session 3: Database Schema (Operations Tables)
// Spec Reference: Part 9, Lines 937-1054
// =============================================================================

import type {
  FAQ,
  FAQInsert,
  FAQUpdate,
  Knowledge,
  KnowledgeInsert,
  KnowledgeUpdate,
  AIConfig,
  AIConfigInsert,
  AIConfigUpdate,
  CallSettings,
  CallSettingsInsert,
  CallSettingsUpdate,
  CalendarIntegration,
  CalendarIntegrationInsert,
  CalendarIntegrationUpdate,
  AvailabilitySlot,
  AvailabilitySlotInsert,
  AvailabilitySlotUpdate,
  PhoneNumber,
  PhoneNumberInsert,
  PhoneNumberUpdate,
} from '@/types/operations';
import type { SupabaseClient } from '@supabase/supabase-js';

// -----------------------------------------------------------------------------
// FAQ Helpers (Spec Lines 937-948)
// -----------------------------------------------------------------------------

/**
 * Get all FAQs for a business, ordered by sort_order
 */
export async function getFAQsByBusinessId(
  supabase: SupabaseClient,
  businessId: string
): Promise<FAQ[]> {
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Create a new FAQ
 */
export async function createFAQ(
  supabase: SupabaseClient,
  faq: FAQInsert
): Promise<FAQ> {
  const { data, error } = await supabase
    .from('faqs')
    .insert(faq)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing FAQ
 */
export async function updateFAQ(
  supabase: SupabaseClient,
  faqId: string,
  updates: FAQUpdate
): Promise<FAQ> {
  const { data, error } = await supabase
    .from('faqs')
    .update(updates)
    .eq('id', faqId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a FAQ
 */
export async function deleteFAQ(
  supabase: SupabaseClient,
  faqId: string
): Promise<void> {
  const { error } = await supabase
    .from('faqs')
    .delete()
    .eq('id', faqId);

  if (error) throw error;
}

/**
 * Bulk create FAQs for a business
 */
export async function bulkCreateFAQs(
  supabase: SupabaseClient,
  faqs: FAQInsert[]
): Promise<FAQ[]> {
  const { data, error } = await supabase
    .from('faqs')
    .insert(faqs)
    .select();

  if (error) throw error;
  return data ?? [];
}

/**
 * Reorder FAQs by updating sort_order values
 */
export async function reorderFAQs(
  supabase: SupabaseClient,
  faqIds: string[]
): Promise<void> {
  const updates = faqIds.map((id, index) => ({
    id,
    sort_order: index,
  }));

  for (const update of updates) {
    const { error } = await supabase
      .from('faqs')
      .update({ sort_order: update.sort_order })
      .eq('id', update.id);

    if (error) throw error;
  }
}

// -----------------------------------------------------------------------------
// Knowledge Helpers (Spec Lines 950-958)
// -----------------------------------------------------------------------------

/**
 * Get knowledge for a business (1:1 relationship)
 */
export async function getKnowledgeByBusinessId(
  supabase: SupabaseClient,
  businessId: string
): Promise<Knowledge | null> {
  const { data, error } = await supabase
    .from('knowledge')
    .select('*')
    .eq('business_id', businessId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Create or update knowledge for a business (upsert due to 1:1)
 */
export async function upsertKnowledge(
  supabase: SupabaseClient,
  knowledge: KnowledgeInsert
): Promise<Knowledge> {
  const { data, error } = await supabase
    .from('knowledge')
    .upsert(knowledge, { onConflict: 'business_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update existing knowledge
 */
export async function updateKnowledge(
  supabase: SupabaseClient,
  businessId: string,
  updates: KnowledgeUpdate
): Promise<Knowledge> {
  const { data, error } = await supabase
    .from('knowledge')
    .update(updates)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// -----------------------------------------------------------------------------
// AI Config Helpers (Spec Lines 960-987)
// -----------------------------------------------------------------------------

/**
 * Get AI config for a business (1:1 relationship)
 */
export async function getAIConfigByBusinessId(
  supabase: SupabaseClient,
  businessId: string
): Promise<AIConfig | null> {
  const { data, error } = await supabase
    .from('ai_config')
    .select('*')
    .eq('business_id', businessId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Create or update AI config for a business (upsert due to 1:1)
 */
export async function upsertAIConfig(
  supabase: SupabaseClient,
  aiConfig: AIConfigInsert
): Promise<AIConfig> {
  const { data, error } = await supabase
    .from('ai_config')
    .upsert(aiConfig, { onConflict: 'business_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update existing AI config
 */
export async function updateAIConfig(
  supabase: SupabaseClient,
  businessId: string,
  updates: AIConfigUpdate
): Promise<AIConfig> {
  const { data, error } = await supabase
    .from('ai_config')
    .update(updates)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Increment system prompt version and update generated timestamp
 */
export async function updateSystemPrompt(
  supabase: SupabaseClient,
  businessId: string,
  prompt: string,
  promptSpanish?: string | null
): Promise<AIConfig> {
  const { data: current, error: fetchError } = await supabase
    .from('ai_config')
    .select('system_prompt_version')
    .eq('business_id', businessId)
    .single();

  if (fetchError) throw fetchError;

  const { data, error } = await supabase
    .from('ai_config')
    .update({
      system_prompt: prompt,
      system_prompt_spanish: promptSpanish ?? null,
      system_prompt_version: (current?.system_prompt_version ?? 0) + 1,
      system_prompt_generated_at: new Date().toISOString(),
    })
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// -----------------------------------------------------------------------------
// Call Settings Helpers (Spec Lines 989-1010)
// -----------------------------------------------------------------------------

/**
 * Get call settings for a business (1:1 relationship)
 */
export async function getCallSettingsByBusinessId(
  supabase: SupabaseClient,
  businessId: string
): Promise<CallSettings | null> {
  const { data, error } = await supabase
    .from('call_settings')
    .select('*')
    .eq('business_id', businessId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Create or update call settings for a business (upsert due to 1:1)
 */
export async function upsertCallSettings(
  supabase: SupabaseClient,
  callSettings: CallSettingsInsert
): Promise<CallSettings> {
  const { data, error } = await supabase
    .from('call_settings')
    .upsert(callSettings, { onConflict: 'business_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update existing call settings
 */
export async function updateCallSettings(
  supabase: SupabaseClient,
  businessId: string,
  updates: CallSettingsUpdate
): Promise<CallSettings> {
  const { data, error } = await supabase
    .from('call_settings')
    .update(updates)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// -----------------------------------------------------------------------------
// Calendar Integration Helpers (Spec Lines 1012-1027)
// -----------------------------------------------------------------------------

/**
 * Get calendar integration for a business (1:1 relationship)
 */
export async function getCalendarIntegrationByBusinessId(
  supabase: SupabaseClient,
  businessId: string
): Promise<CalendarIntegration | null> {
  const { data, error } = await supabase
    .from('calendar_integrations')
    .select('*')
    .eq('business_id', businessId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Create or update calendar integration for a business (upsert due to 1:1)
 */
export async function upsertCalendarIntegration(
  supabase: SupabaseClient,
  integration: CalendarIntegrationInsert
): Promise<CalendarIntegration> {
  const { data, error } = await supabase
    .from('calendar_integrations')
    .upsert(integration, { onConflict: 'business_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update existing calendar integration
 */
export async function updateCalendarIntegration(
  supabase: SupabaseClient,
  businessId: string,
  updates: CalendarIntegrationUpdate
): Promise<CalendarIntegration> {
  const { data, error } = await supabase
    .from('calendar_integrations')
    .update(updates)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update OAuth tokens for a calendar integration
 */
export async function updateCalendarTokens(
  supabase: SupabaseClient,
  businessId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date
): Promise<CalendarIntegration> {
  const { data, error } = await supabase
    .from('calendar_integrations')
    .update({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Check if calendar tokens need refresh (expired or expiring soon)
 */
export function calendarTokensNeedRefresh(
  integration: CalendarIntegration,
  bufferMinutes: number = 5
): boolean {
  if (!integration.token_expires_at) return true;
  
  const expiresAt = new Date(integration.token_expires_at);
  const now = new Date();
  const bufferMs = bufferMinutes * 60 * 1000;
  
  return expiresAt.getTime() - now.getTime() < bufferMs;
}

// -----------------------------------------------------------------------------
// Availability Slots Helpers (Spec Lines 1029-1038)
// -----------------------------------------------------------------------------

/**
 * Get all availability slots for a business
 */
export async function getAvailabilitySlotsByBusinessId(
  supabase: SupabaseClient,
  businessId: string
): Promise<AvailabilitySlot[]> {
  const { data, error } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('business_id', businessId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Get availability slots for a specific day
 */
export async function getAvailabilitySlotsByDay(
  supabase: SupabaseClient,
  businessId: string,
  dayOfWeek: number
): Promise<AvailabilitySlot[]> {
  const { data, error } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('business_id', businessId)
    .eq('day_of_week', dayOfWeek)
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Create availability slot
 */
export async function createAvailabilitySlot(
  supabase: SupabaseClient,
  slot: AvailabilitySlotInsert
): Promise<AvailabilitySlot> {
  const { data, error } = await supabase
    .from('availability_slots')
    .insert(slot)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete an availability slot
 */
export async function deleteAvailabilitySlot(
  supabase: SupabaseClient,
  slotId: string
): Promise<void> {
  const { error } = await supabase
    .from('availability_slots')
    .delete()
    .eq('id', slotId);

  if (error) throw error;
}

/**
 * Replace all availability slots for a business
 * (Delete existing and insert new ones)
 */
export async function replaceAvailabilitySlots(
  supabase: SupabaseClient,
  businessId: string,
  slots: Omit<AvailabilitySlotInsert, 'business_id'>[]
): Promise<AvailabilitySlot[]> {
  // Delete existing slots
  const { error: deleteError } = await supabase
    .from('availability_slots')
    .delete()
    .eq('business_id', businessId);

  if (deleteError) throw deleteError;

  // Insert new slots
  if (slots.length === 0) return [];

  const slotsWithBusinessId = slots.map((slot) => ({
    ...slot,
    business_id: businessId,
  }));

  const { data, error: insertError } = await supabase
    .from('availability_slots')
    .insert(slotsWithBusinessId)
    .select();

  if (insertError) throw insertError;
  return data ?? [];
}

// -----------------------------------------------------------------------------
// Phone Number Helpers (Spec Lines 1040-1054)
// -----------------------------------------------------------------------------

/**
 * Get all phone numbers for a business
 */
export async function getPhoneNumbersByBusinessId(
  supabase: SupabaseClient,
  businessId: string
): Promise<PhoneNumber[]> {
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Get active phone number for a business
 */
export async function getActivePhoneNumber(
  supabase: SupabaseClient,
  businessId: string
): Promise<PhoneNumber | null> {
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Get phone number by E.164 number
 */
export async function getPhoneNumberByNumber(
  supabase: SupabaseClient,
  number: string
): Promise<PhoneNumber | null> {
  const { data, error } = await supabase
    .from('phone_numbers')
    .select('*')
    .eq('number', number)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Create a new phone number
 */
export async function createPhoneNumber(
  supabase: SupabaseClient,
  phoneNumber: PhoneNumberInsert
): Promise<PhoneNumber> {
  const { data, error } = await supabase
    .from('phone_numbers')
    .insert(phoneNumber)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update phone number
 */
export async function updatePhoneNumber(
  supabase: SupabaseClient,
  phoneNumberId: string,
  updates: PhoneNumberUpdate
): Promise<PhoneNumber> {
  const { data, error } = await supabase
    .from('phone_numbers')
    .update(updates)
    .eq('id', phoneNumberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Deactivate a phone number
 */
export async function deactivatePhoneNumber(
  supabase: SupabaseClient,
  phoneNumberId: string
): Promise<PhoneNumber> {
  return updatePhoneNumber(supabase, phoneNumberId, { is_active: false });
}

/**
 * Set a phone number as active (and deactivate others for the same business)
 */
export async function setActivePhoneNumber(
  supabase: SupabaseClient,
  phoneNumberId: string,
  businessId: string
): Promise<PhoneNumber> {
  // Deactivate all other numbers for this business
  const { error: deactivateError } = await supabase
    .from('phone_numbers')
    .update({ is_active: false })
    .eq('business_id', businessId)
    .neq('id', phoneNumberId);

  if (deactivateError) throw deactivateError;

  // Activate the specified number
  return updatePhoneNumber(supabase, phoneNumberId, { is_active: true });
}

// -----------------------------------------------------------------------------
// SMS Message Helpers (Spec Lines 1109-1127)
// Session 12: Full Twilio Integration
// -----------------------------------------------------------------------------

import type { SMSMessage, NotificationSettings } from '@/types';

export type SMSMessageInsert = {
  id?: string;
  business_id: string;
  call_id?: string | null;
  appointment_id?: string | null;
  direction: 'inbound' | 'outbound';
  message_type: 'booking_confirmation' | 'reminder' | 'message_alert' | 'usage_alert' | 'transfer_alert';
  from_number?: string | null;
  to_number?: string | null;
  body?: string | null;
  twilio_sid?: string | null;
  status?: 'sent' | 'delivered' | 'failed';
  sent_at?: string;
};

export type SMSMessageUpdate = {
  status?: 'sent' | 'delivered' | 'failed';
};

/**
 * Get SMS messages for a business
 */
export async function getSMSMessagesByBusinessId(
  supabase: SupabaseClient,
  businessId: string,
  limit: number = 50
): Promise<SMSMessage[]> {
  const { data, error } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('business_id', businessId)
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/**
 * Get SMS messages for a specific call
 */
export async function getSMSMessagesByCallId(
  supabase: SupabaseClient,
  callId: string
): Promise<SMSMessage[]> {
  const { data, error } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('call_id', callId)
    .order('sent_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Create a new SMS message record
 */
export async function createSMSMessage(
  supabase: SupabaseClient,
  message: SMSMessageInsert
): Promise<SMSMessage> {
  const { data, error } = await supabase
    .from('sms_messages')
    .insert(message)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update SMS message status
 */
export async function updateSMSMessageStatus(
  supabase: SupabaseClient,
  twilioSid: string,
  status: 'sent' | 'delivered' | 'failed'
): Promise<void> {
  const { error } = await supabase
    .from('sms_messages')
    .update({ status })
    .eq('twilio_sid', twilioSid);

  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Notification Settings Helpers (Spec Lines 1128-1141)
// -----------------------------------------------------------------------------

export type NotificationSettingsInsert = {
  id?: string;
  business_id: string;
  sms_all_calls?: boolean;
  sms_bookings?: boolean;
  sms_missed?: boolean;
  sms_messages?: boolean;
  sms_usage_alerts?: boolean;
  email_daily?: boolean;
  email_weekly?: boolean;
  sms_customer_confirmation?: boolean;
  sms_customer_reminder?: 'off' | '1hr' | '24hr';
};

export type NotificationSettingsUpdate = {
  sms_all_calls?: boolean;
  sms_bookings?: boolean;
  sms_missed?: boolean;
  sms_messages?: boolean;
  sms_usage_alerts?: boolean;
  email_daily?: boolean;
  email_weekly?: boolean;
  sms_customer_confirmation?: boolean;
  sms_customer_reminder?: 'off' | '1hr' | '24hr';
};

/**
 * Get notification settings for a business
 */
export async function getNotificationSettingsByBusinessId(
  supabase: SupabaseClient,
  businessId: string
): Promise<NotificationSettings | null> {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('business_id', businessId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Create or update notification settings (upsert due to 1:1)
 */
export async function upsertNotificationSettings(
  supabase: SupabaseClient,
  settings: NotificationSettingsInsert
): Promise<NotificationSettings> {
  const { data, error } = await supabase
    .from('notification_settings')
    .upsert(settings, { onConflict: 'business_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update notification settings
 */
export async function updateNotificationSettings(
  supabase: SupabaseClient,
  businessId: string,
  updates: NotificationSettingsUpdate
): Promise<NotificationSettings> {
  const { data, error } = await supabase
    .from('notification_settings')
    .update(updates)
    .eq('business_id', businessId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
