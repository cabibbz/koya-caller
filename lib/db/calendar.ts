/**
 * Calendar Integration Database Helpers
 * Spec Reference: Part 9, Lines 1012-1027
 */

import type {
  CalendarIntegration,
  CalendarIntegrationInsert,
  CalendarIntegrationUpdate,
} from '@/types/operations';
import type { SupabaseClient } from '@supabase/supabase-js';

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
