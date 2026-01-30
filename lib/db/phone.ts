/**
 * Phone Number Database Helpers
 * Spec Reference: Part 9, Lines 1040-1054
 */

import type {
  PhoneNumber,
  PhoneNumberInsert,
  PhoneNumberUpdate,
} from '@/types/operations';
import type { SupabaseClient } from '@supabase/supabase-js';

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
