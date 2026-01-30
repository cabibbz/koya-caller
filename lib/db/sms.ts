/**
 * SMS Message Database Helpers
 * Spec Reference: Part 9, Lines 1109-1127
 * Session 12: Full Twilio Integration
 */

import type { SMSMessage } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';

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
