/**
 * Database Helpers - Contacts (Caller Profiles)
 * Customer/Contact Management feature
 * PRODUCT_ROADMAP.md Section 2.3
 */

import { createClient } from "@/lib/supabase/server";
import { sanitizeSqlPattern } from "@/lib/security";
import type { CallerProfile, Call, Appointment, CallerTier } from "@/types";

/**
 * Helper to get a Supabase client
 */
async function getClient() {
  return createClient();
}

// =============================================================================
// Contact Types
// =============================================================================

export interface ContactFilters {
  search?: string;
  vipOnly?: boolean;
  tier?: CallerTier;
  limit?: number;
  offset?: number;
}

export interface ContactUpdate {
  name?: string | null;
  email?: string | null;
  notes?: string | null;
  vip_status?: boolean;
}

export interface ContactWithStats extends CallerProfile {
  total_calls: number;
}

// =============================================================================
// Contact Helpers
// =============================================================================

/**
 * Get all contacts for a business with optional filters
 */
export async function getContactsByBusinessId(
  businessId: string,
  filters: ContactFilters = {}
): Promise<{ contacts: ContactWithStats[]; total: number }> {
  const supabase = await getClient();
  const { search, vipOnly, tier, limit = 50, offset = 0 } = filters;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("caller_profiles")
    .select("id, business_id, phone_number, name, email, notes, vip_status, created_at, updated_at", { count: "exact" })
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  // Apply VIP filter
  if (vipOnly) {
    query = query.eq("vip_status", true);
  }

  // Apply tier filter (simplified - call_count column may not exist)
  if (tier) {
    switch (tier) {
      case "vip":
        query = query.eq("vip_status", true);
        break;
      case "returning":
        query = query.eq("vip_status", false);
        break;
      case "new":
        query = query.eq("vip_status", false);
        break;
    }
  }

  // Apply search filter (searches in name, phone, email)
  if (search) {
    const sanitized = sanitizeSqlPattern(search);
    query = query.or(
      `name.ilike.%${sanitized}%,phone_number.ilike.%${sanitized}%,email.ilike.%${sanitized}%`
    );
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw error;

  // Map to ContactWithStats format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contacts: ContactWithStats[] = (data ?? []).map((profile: any) => ({
    ...profile,
    total_calls: 0, // call_count column may not exist yet
    vip_status: profile.vip_status ?? false,
    notes: profile.notes ?? null,
  }));

  return { contacts, total: count ?? 0 };
}

/**
 * Get a single contact by ID
 */
export async function getContactById(id: string): Promise<ContactWithStats | null> {
  const supabase = await getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("caller_profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;

  return {
    ...data,
    total_calls: data.call_count ?? 0,
    vip_status: data.vip_status ?? false,
    notes: data.notes ?? null,
  };
}

/**
 * Get a contact by phone number for a business
 */
export async function getContactByPhone(
  businessId: string,
  phoneNumber: string
): Promise<ContactWithStats | null> {
  const supabase = await getClient();

  // Normalize phone number for search
  const normalizedPhone = phoneNumber.replace(/\D/g, "");

  // Sanitize phone numbers for use in .or() query to prevent injection
  const sanitizedPhone = sanitizeSqlPattern(phoneNumber);
  const sanitizedNormalized = sanitizeSqlPattern(normalizedPhone);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("caller_profiles")
    .select("*")
    .eq("business_id", businessId)
    .or(`phone_number.eq.${sanitizedPhone},phone_number.eq.+1${sanitizedNormalized},phone_number.eq.${sanitizedNormalized}`)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;

  return {
    ...data,
    total_calls: data.call_count ?? 0,
    vip_status: data.vip_status ?? false,
    notes: data.notes ?? null,
  };
}

/**
 * Update a contact
 */
export async function updateContact(
  id: string,
  updates: ContactUpdate
): Promise<ContactWithStats> {
  const supabase = await getClient();

  const updateData: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("caller_profiles")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to update contact");

  return {
    ...data,
    total_calls: data.call_count ?? 0,
    vip_status: data.vip_status ?? false,
    notes: data.notes ?? null,
  };
}

/**
 * Create a new contact
 */
export async function createContact(
  businessId: string,
  contact: {
    phone_number: string;
    name?: string;
    email?: string;
    notes?: string;
    vip_status?: boolean;
  }
): Promise<ContactWithStats> {
  const supabase = await getClient();

  const insertData = {
    business_id: businessId,
    phone_number: contact.phone_number,
    name: contact.name || null,
    email: contact.email || null,
    notes: contact.notes || null,
    vip_status: contact.vip_status ?? false,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("caller_profiles")
    .insert(insertData)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to create contact");

  return {
    ...data,
    total_calls: data.call_count ?? 0,
    vip_status: data.vip_status ?? false,
    notes: data.notes ?? null,
  };
}

/**
 * Delete a contact
 */
export async function deleteContact(id: string): Promise<void> {
  const supabase = await getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("caller_profiles")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/**
 * Get call history for a contact
 */
export async function getContactCallHistory(
  businessId: string,
  phoneNumber: string,
  limit: number = 50
): Promise<Call[]> {
  const supabase = await getClient();

  // Normalize phone number for search - try multiple formats
  const cleanedPhone = phoneNumber.replace(/\D/g, "");

  // Sanitize phone numbers for use in .or() query to prevent injection
  const sanitizedPhone = sanitizeSqlPattern(phoneNumber);
  const sanitizedCleaned = sanitizeSqlPattern(cleanedPhone);

  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .eq("business_id", businessId)
    .or(`from_number.eq.${sanitizedPhone},from_number.eq.+1${sanitizedCleaned},from_number.eq.${sanitizedCleaned},from_number.ilike.%${sanitizedCleaned}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Call[];
}

/**
 * Get appointment history for a contact
 */
export async function getContactAppointments(
  businessId: string,
  phoneNumber: string,
  limit: number = 50
): Promise<Appointment[]> {
  const supabase = await getClient();

  // Normalize phone number for search
  const cleanedPhone = phoneNumber.replace(/\D/g, "");

  // Sanitize phone numbers for use in .or() query to prevent injection
  const sanitizedPhone = sanitizeSqlPattern(phoneNumber);
  const sanitizedCleaned = sanitizeSqlPattern(cleanedPhone);

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("business_id", businessId)
    .or(`customer_phone.eq.${sanitizedPhone},customer_phone.eq.+1${sanitizedCleaned},customer_phone.eq.${sanitizedCleaned},customer_phone.ilike.%${sanitizedCleaned}`)
    .order("scheduled_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Appointment[];
}

/**
 * Get contact stats for dashboard
 */
export async function getContactStats(businessId: string): Promise<{
  total: number;
  vipCount: number;
  newThisMonth: number;
  returningCount: number;
}> {
  const supabase = await getClient();

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [totalResult, vipResult, newResult, returningResult] = await Promise.all([
    // Total contacts
    sb
      .from("caller_profiles")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId),
    // VIP contacts
    sb
      .from("caller_profiles")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("vip_status", true),
    // New contacts this month
    sb
      .from("caller_profiles")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", monthStart),
    // Returning contacts (called more than once)
    sb
      .from("caller_profiles")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gt("call_count", 1),
  ]);

  if (totalResult.error) throw totalResult.error;
  if (vipResult.error) throw vipResult.error;
  if (newResult.error) throw newResult.error;
  if (returningResult.error) throw returningResult.error;

  return {
    total: totalResult.count ?? 0,
    vipCount: vipResult.count ?? 0,
    newThisMonth: newResult.count ?? 0,
    returningCount: returningResult.count ?? 0,
  };
}

/**
 * Export contacts as CSV data
 */
export async function getContactsForExport(
  businessId: string,
  filters: ContactFilters = {}
): Promise<ContactWithStats[]> {
  const supabase = await getClient();
  const { search, vipOnly, tier } = filters;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("caller_profiles")
    .select("*")
    .eq("business_id", businessId)
    .order("last_call_at", { ascending: false });

  // Apply VIP filter
  if (vipOnly) {
    query = query.eq("vip_status", true);
  }

  // Apply tier filter (simplified - call_count column may not exist)
  if (tier) {
    switch (tier) {
      case "vip":
        query = query.eq("vip_status", true);
        break;
      case "returning":
        query = query.eq("vip_status", false);
        break;
      case "new":
        query = query.eq("vip_status", false);
        break;
    }
  }

  // Apply search filter
  if (search) {
    const sanitized = sanitizeSqlPattern(search);
    query = query.or(
      `name.ilike.%${sanitized}%,phone_number.ilike.%${sanitized}%,email.ilike.%${sanitized}%`
    );
  }

  const { data, error } = await query;

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((profile: any) => ({
    ...profile,
    total_calls: 0, // call_count column may not exist yet
    vip_status: profile.vip_status ?? false,
    notes: profile.notes ?? null,
  }));
}
