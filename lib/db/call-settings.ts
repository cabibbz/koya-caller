/**
 * Call Settings Database Helpers
 * Spec Reference: Part 9, Lines 989-1010
 */

import type {
  CallSettings,
  CallSettingsInsert,
  CallSettingsUpdate,
} from '@/types/operations';
import type { SupabaseClient } from '@supabase/supabase-js';

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
