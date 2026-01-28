/**
 * Availability Database Helpers
 * Spec Reference: Part 9, Lines 1029-1038
 * Extended with blocked_dates and service_availability (migration 20250122000002)
 *
 * Note: Some type assertions are used for new tables (blocked_dates, service_availability)
 * that may not be in the generated Supabase types yet. After running the migration and
 * regenerating types with `supabase gen types typescript`, these can be cleaned up.
 */

import type {
  AvailabilitySlot,
  AvailabilitySlotInsert,
} from '@/types/operations';
import type { BlockedDate, ServiceAvailability, BusinessHours } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Type definitions for insert operations (used before migration is run)
interface BlockedDateInsertData {
  business_id: string;
  blocked_date: string;
  reason?: string | null;
  is_recurring?: boolean;
}

interface ServiceAvailabilityInsertData {
  service_id: string;
  day_of_week: number;
  open_time?: string | null;
  close_time?: string | null;
  is_closed?: boolean;
  use_business_hours?: boolean;
}

interface BusinessHoursInsertData {
  business_id: string;
  day_of_week: number;
  open_time?: string | null;
  close_time?: string | null;
  is_closed: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

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

// ============================================
// Business Hours Helpers
// ============================================

/**
 * Get business hours for a business
 */
export async function getBusinessHoursById(
  businessId: string
): Promise<BusinessHours[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('business_hours')
    .select('*')
    .eq('business_id', businessId)
    .order('day_of_week', { ascending: true });

  if (error) throw error;
  return (data ?? []) as BusinessHours[];
}

/**
 * Update business hours for a business
 * Deletes existing hours and inserts new ones
 */
export async function updateBusinessHoursById(
  businessId: string,
  hours: Omit<BusinessHours, 'id' | 'business_id'>[]
): Promise<void> {
  const supabase = await createClient() as AnySupabaseClient;

  // Delete existing hours
  const { error: deleteError } = await supabase
    .from('business_hours')
    .delete()
    .eq('business_id', businessId);

  if (deleteError) throw deleteError;

  // Insert new hours
  if (hours.length === 0) return;

  const hoursWithBusiness: BusinessHoursInsertData[] = hours.map((h) => ({
    business_id: businessId,
    day_of_week: h.day_of_week,
    open_time: h.open_time,
    close_time: h.close_time,
    is_closed: h.is_closed,
  }));

  const { error: insertError } = await supabase
    .from('business_hours')
    .insert(hoursWithBusiness);

  if (insertError) throw insertError;
}

// ============================================
// Blocked Dates Helpers
// ============================================

/**
 * Get all blocked dates for a business
 */
export async function getBlockedDates(
  businessId: string
): Promise<BlockedDate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blocked_dates')
    .select('*')
    .eq('business_id', businessId)
    .order('blocked_date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as BlockedDate[];
}

/**
 * Get blocked dates for a specific date range
 */
export async function getBlockedDatesInRange(
  businessId: string,
  startDate: string,
  endDate: string
): Promise<BlockedDate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blocked_dates')
    .select('*')
    .eq('business_id', businessId)
    .gte('blocked_date', startDate)
    .lte('blocked_date', endDate)
    .order('blocked_date', { ascending: true });

  if (error) throw error;
  return (data ?? []) as BlockedDate[];
}

/**
 * Add a blocked date
 */
export async function addBlockedDate(
  businessId: string,
  date: string,
  reason?: string | null,
  isRecurring?: boolean
): Promise<BlockedDate> {
  const supabase = await createClient() as AnySupabaseClient;
  const insertData: BlockedDateInsertData = {
    business_id: businessId,
    blocked_date: date,
    reason: reason ?? null,
    is_recurring: isRecurring ?? false,
  };

  const { data, error } = await supabase
    .from('blocked_dates')
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  return data as BlockedDate;
}

/**
 * Remove a blocked date
 */
export async function removeBlockedDate(
  blockedDateId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('blocked_dates')
    .delete()
    .eq('id', blockedDateId);

  if (error) throw error;
}

/**
 * Check if a date is blocked
 */
export async function isDateBlocked(
  businessId: string,
  date: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blocked_dates')
    .select('id')
    .eq('business_id', businessId)
    .eq('blocked_date', date)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

// ============================================
// Service Availability Helpers
// ============================================

/**
 * Get availability for a specific service
 */
export async function getServiceAvailability(
  serviceId: string
): Promise<ServiceAvailability[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_availability')
    .select('*')
    .eq('service_id', serviceId)
    .order('day_of_week', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ServiceAvailability[];
}

/**
 * Get availability for all services in a business
 */
export async function getServicesAvailabilityByBusinessId(
  businessId: string
): Promise<Map<string, ServiceAvailability[]>> {
  const supabase = await createClient() as AnySupabaseClient;

  // First get all services for the business
  const { data: services, error: servicesError } = await supabase
    .from('services')
    .select('id')
    .eq('business_id', businessId);

  if (servicesError) throw servicesError;
  if (!services || services.length === 0) return new Map();

  const serviceIds = (services as { id: string }[]).map((s) => s.id);

  // Then get availability for all those services
  const { data, error } = await supabase
    .from('service_availability')
    .select('*')
    .in('service_id', serviceIds)
    .order('day_of_week', { ascending: true });

  if (error) throw error;

  // Group by service_id
  const availabilityMap = new Map<string, ServiceAvailability[]>();
  const rows = (data ?? []) as ServiceAvailability[];
  rows.forEach((row) => {
    const existing = availabilityMap.get(row.service_id) || [];
    existing.push(row);
    availabilityMap.set(row.service_id, existing);
  });

  return availabilityMap;
}

/**
 * Update service availability (replace all days)
 */
export async function updateServiceAvailability(
  serviceId: string,
  availability: Omit<ServiceAvailability, 'id' | 'service_id'>[]
): Promise<ServiceAvailability[]> {
  const supabase = await createClient() as AnySupabaseClient;

  // Delete existing availability for this service
  const { error: deleteError } = await supabase
    .from('service_availability')
    .delete()
    .eq('service_id', serviceId);

  if (deleteError) throw deleteError;

  // Insert new availability
  if (availability.length === 0) return [];

  const availabilityWithService: ServiceAvailabilityInsertData[] = availability.map((a) => ({
    service_id: serviceId,
    day_of_week: a.day_of_week,
    open_time: a.open_time,
    close_time: a.close_time,
    is_closed: a.is_closed,
    use_business_hours: a.use_business_hours,
  }));

  const { data, error: insertError } = await supabase
    .from('service_availability')
    .insert(availabilityWithService)
    .select();

  if (insertError) throw insertError;
  return (data ?? []) as ServiceAvailability[];
}

/**
 * Set service to use business hours (clear custom availability)
 */
export async function setServiceUseBusinessHours(
  serviceId: string
): Promise<void> {
  const supabase = await createClient();

  // Delete any custom availability
  const { error } = await supabase
    .from('service_availability')
    .delete()
    .eq('service_id', serviceId);

  if (error) throw error;
}

/**
 * Check if a service has custom availability
 */
export async function hasCustomAvailability(
  serviceId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('service_availability')
    .select('id')
    .eq('service_id', serviceId)
    .eq('use_business_hours', false)
    .limit(1);

  if (error) throw error;
  return (data ?? []).length > 0;
}
