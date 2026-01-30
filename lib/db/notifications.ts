/**
 * Notification Settings Database Helpers
 * Spec Reference: Part 9, Lines 1128-1141
 */

import type { NotificationSettings } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';

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
