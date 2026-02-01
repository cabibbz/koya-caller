/**
 * SMS Opt-Out Database Helpers
 * TCPA Compliance: Track customer SMS opt-out/opt-in status
 *
 * This module provides functions to:
 * - Record when customers opt out (STOP/UNSUBSCRIBE)
 * - Record when customers opt back in (START)
 * - Check if a number is opted out before sending SMS
 * - List all opted-out numbers for a business
 */

import { toE164 } from '@/lib/utils/phone';
import { logError } from '@/lib/logging';

// Use generic type to avoid Supabase RLS type inference issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

// =============================================================================
// TYPES
// =============================================================================

export interface SMSOptOut {
  id: string;
  business_id: string;
  phone_number: string;
  opted_out_at: string;
  opted_back_in_at: string | null;
  is_active: boolean;
  opt_out_keyword: string;
  source: string;
  created_at: string;
}

export type OptOutSource = 'sms' | 'web' | 'api';

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Record an SMS opt-out for a phone number
 * Uses upsert to handle both new opt-outs and re-opt-outs
 *
 * @param supabase - Supabase client (admin/service role for webhook context)
 * @param businessId - The business ID
 * @param phoneNumber - Phone number (will be normalized to E.164)
 * @param keyword - The keyword used to opt out (e.g., STOP, UNSUBSCRIBE)
 * @param source - How the opt-out was received (defaults to 'sms')
 */
export async function recordOptOut(
  supabase: SupabaseClient,
  businessId: string,
  phoneNumber: string,
  keyword: string,
  source: OptOutSource = 'sms'
): Promise<SMSOptOut> {
  // Normalize phone number to E.164 format
  const normalizedPhone = toE164(phoneNumber) || phoneNumber;

  // Upsert: insert new record or update existing one
  // If the number was previously opted in, this reactivates the opt-out
  const { data, error } = await supabase
    .from('sms_opt_outs')
    .upsert(
      {
        business_id: businessId,
        phone_number: normalizedPhone,
        opted_out_at: new Date().toISOString(),
        opted_back_in_at: null,
        is_active: true,
        opt_out_keyword: keyword.toUpperCase(),
        source,
      },
      {
        onConflict: 'business_id,phone_number',
      }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Record an SMS opt-in (when customer texts START)
 * Updates the existing opt-out record to mark it as inactive
 *
 * @param supabase - Supabase client (admin/service role for webhook context)
 * @param businessId - The business ID
 * @param phoneNumber - Phone number (will be normalized to E.164)
 */
export async function recordOptIn(
  supabase: SupabaseClient,
  businessId: string,
  phoneNumber: string
): Promise<SMSOptOut | null> {
  // Normalize phone number to E.164 format
  const normalizedPhone = toE164(phoneNumber) || phoneNumber;

  // Update the opt-out record to mark as inactive
  const { data, error } = await supabase
    .from('sms_opt_outs')
    .update({
      opted_back_in_at: new Date().toISOString(),
      is_active: false,
    })
    .eq('business_id', businessId)
    .eq('phone_number', normalizedPhone)
    .eq('is_active', true)
    .select()
    .single();

  // If no record found (user wasn't opted out), that's okay
  if (error && error.code === 'PGRST116') {
    return null;
  }

  if (error) throw error;
  return data;
}

/**
 * Check if a phone number is opted out for a business
 * Use this before sending any SMS to ensure TCPA compliance
 *
 * @param supabase - Supabase client
 * @param businessId - The business ID
 * @param phoneNumber - Phone number to check (will be normalized to E.164)
 * @returns true if opted out, false if can receive SMS
 */
export async function isOptedOut(
  supabase: SupabaseClient,
  businessId: string,
  phoneNumber: string
): Promise<boolean> {
  // Normalize phone number to E.164 format
  const normalizedPhone = toE164(phoneNumber) || phoneNumber;

  const { data, error } = await supabase
    .from('sms_opt_outs')
    .select('id')
    .eq('business_id', businessId)
    .eq('phone_number', normalizedPhone)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    // Log error but default to allowing SMS (Twilio will also check)
    logError('SMS Opt-Out Check', error);
    return false;
  }

  return data !== null;
}

/**
 * Get all opted-out phone numbers for a business
 * Useful for admin dashboards and compliance reporting
 *
 * @param supabase - Supabase client
 * @param businessId - The business ID
 * @param includeInactive - Whether to include numbers that have opted back in
 */
export async function getOptOutList(
  supabase: SupabaseClient,
  businessId: string,
  includeInactive: boolean = false
): Promise<SMSOptOut[]> {
  let query = supabase
    .from('sms_opt_outs')
    .select('*')
    .eq('business_id', businessId)
    .order('opted_out_at', { ascending: false });

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data ?? [];
}

/**
 * Get opt-out statistics for a business
 * Returns counts for active opt-outs and total historical opt-outs
 */
export async function getOptOutStats(
  supabase: SupabaseClient,
  businessId: string
): Promise<{ active: number; total: number; reOptIns: number }> {
  // Get all records for this business
  const { data, error } = await supabase
    .from('sms_opt_outs')
    .select('is_active, opted_back_in_at')
    .eq('business_id', businessId);

  if (error) throw error;

  const records = (data ?? []) as Array<{ is_active: boolean; opted_back_in_at: string | null }>;
  const active = records.filter((r) => r.is_active).length;
  const reOptIns = records.filter((r) => r.opted_back_in_at !== null).length;

  return {
    active,
    total: records.length,
    reOptIns,
  };
}
