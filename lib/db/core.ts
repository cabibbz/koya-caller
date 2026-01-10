/**
 * Database Helpers - Core Tables
 * Type-safe database operations for users, plans, businesses, business_hours, services
 * 
 * Spec Reference: Part 9, Lines 852-936
 * 
 * Note: These helpers use types from @/types/index.ts for application-level types.
 * Supabase Database types in @/types/supabase.ts are for client type hints.
 */

import { createClient } from "@/lib/supabase/server";
import type {
  Business,
  BusinessHours,
  Plan,
  Service,
} from "@/types";

/**
 * Helper to get a loosely-typed Supabase client for write operations
 * This works around Supabase type inference issues in strict mode
 */
async function getWriteClient(): Promise<any> {
  return createClient();
}

// ============================================
// Plans (Spec Lines 863-874)
// ============================================

/**
 * Get all active plans
 */
export async function getActivePlans(): Promise<Plan[]> {
  const supabase = await getWriteClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (error) throw error;
  return (data ?? []) as Plan[];
}

/**
 * Get a plan by slug
 */
export async function getPlanBySlug(slug: string): Promise<Plan | null> {
  const supabase = await getWriteClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as Plan | null;
}

/**
 * Get a plan by ID
 */
export async function getPlanById(id: string): Promise<Plan | null> {
  const supabase = await getWriteClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as Plan | null;
}

// ============================================
// Businesses (Spec Lines 876-907)
// ============================================

/**
 * Get a business by ID
 */
export async function getBusinessById(id: string): Promise<Business | null> {
  const supabase = await getWriteClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as Business | null;
}

/**
 * Get a business by user ID
 */
export async function getBusinessByUserId(userId: string): Promise<Business | null> {
  const supabase = await getWriteClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as Business | null;
}

/**
 * Create a new business
 */
export async function createBusiness(business: Partial<Business> & { name: string }): Promise<Business> {
  const supabase = await getWriteClient();
  const { data, error } = await supabase
    .from("businesses")
    .insert(business as any)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to create business");
  return data as Business;
}

/**
 * Update a business
 */
export async function updateBusiness(
  id: string,
  updates: Partial<Business>
): Promise<Business> {
  const supabase = await getWriteClient();
  const { data, error } = await (supabase as any)
    .from("businesses")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to update business");
  return data as Business;
}

/**
 * Update business onboarding step
 * Spec Line 889: onboarding_step tracks progress for resume
 */
export async function updateOnboardingStep(
  businessId: string,
  step: number
): Promise<void> {
  const supabase = await getWriteClient();
  const updates: Record<string, unknown> = { onboarding_step: step };

  // If completing onboarding (step 8 done), mark completion
  if (step > 8) {
    updates.onboarding_completed_at = new Date().toISOString();
    updates.subscription_status = "active";
  }

  const { error } = await supabase
    .from("businesses")
    .update(updates)
    .eq("id", businessId);

  if (error) throw error;
}

/**
 * Update usage minutes for a business
 * Spec Lines 895-900: Usage tracking
 */
export async function incrementUsageMinutes(
  businessId: string,
  minutes: number
): Promise<Business> {
  const supabase = await getWriteClient();

  // First get current usage
  const { data: business, error: fetchError } = await supabase
    .from("businesses")
    .select("minutes_used_this_cycle")
    .eq("id", businessId)
    .single();

  if (fetchError) throw fetchError;
  if (!business) throw new Error("Business not found");

  // Update with new total
  const currentMinutes = (business as { minutes_used_this_cycle: number }).minutes_used_this_cycle ?? 0;
  const newTotal = currentMinutes + minutes;
  const { data, error } = await supabase
    .from("businesses")
    .update({ minutes_used_this_cycle: newTotal })
    .eq("id", businessId)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to update usage minutes");
  return data as Business;
}

/**
 * Reset billing cycle for a business
 * Called by Stripe webhook on subscription renewal
 */
export async function resetBillingCycle(
  businessId: string,
  cycleStart: Date,
  cycleEnd: Date
): Promise<void> {
  const supabase = await getWriteClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      current_cycle_start: cycleStart.toISOString().split("T")[0],
      current_cycle_end: cycleEnd.toISOString().split("T")[0],
      minutes_used_this_cycle: 0,
      last_usage_alert_percent: 0,
    })
    .eq("id", businessId);

  if (error) throw error;
}

// ============================================
// Business Hours (Spec Lines 909-918)
// ============================================

/**
 * Get business hours for a business
 */
export async function getBusinessHours(businessId: string): Promise<BusinessHours[]> {
  const supabase = await getWriteClient();
  const { data, error } = await supabase
    .from("business_hours")
    .select("*")
    .eq("business_id", businessId)
    .order("day_of_week");

  if (error) throw error;
  return (data ?? []) as BusinessHours[];
}

/**
 * Set business hours (upsert all 7 days)
 */
export async function setBusinessHours(
  businessId: string,
  hours: Omit<BusinessHours, "id" | "business_id">[]
): Promise<void> {
  const supabase = await getWriteClient();

  // Delete existing hours
  const { error: deleteError } = await supabase
    .from("business_hours")
    .delete()
    .eq("business_id", businessId);

  if (deleteError) throw deleteError;

  // Insert new hours
  const hoursWithBusiness = hours.map((h) => ({
    ...h,
    business_id: businessId,
  }));

  const { error } = await supabase
    .from("business_hours")
    .insert(hoursWithBusiness as any[]);

  if (error) throw error;
}

/**
 * Create default business hours (M-F 9-5, closed weekends)
 */
export async function createDefaultBusinessHours(businessId: string): Promise<void> {
  const defaultHours: Omit<BusinessHours, "id" | "business_id">[] = [
    { day_of_week: 0, is_closed: true, open_time: null, close_time: null }, // Sunday
    { day_of_week: 1, open_time: "09:00", close_time: "17:00", is_closed: false },
    { day_of_week: 2, open_time: "09:00", close_time: "17:00", is_closed: false },
    { day_of_week: 3, open_time: "09:00", close_time: "17:00", is_closed: false },
    { day_of_week: 4, open_time: "09:00", close_time: "17:00", is_closed: false },
    { day_of_week: 5, open_time: "09:00", close_time: "17:00", is_closed: false },
    { day_of_week: 6, is_closed: true, open_time: null, close_time: null }, // Saturday
  ];

  await setBusinessHours(businessId, defaultHours);
}

// ============================================
// Services (Spec Lines 920-935)
// ============================================

/**
 * Get all services for a business
 */
export async function getServices(businessId: string): Promise<Service[]> {
  const supabase = await getWriteClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", businessId)
    .order("sort_order");

  if (error) throw error;
  return (data ?? []) as Service[];
}

/**
 * Get a single service by ID
 */
export async function getServiceById(id: string): Promise<Service | null> {
  const supabase = await getWriteClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as Service | null;
}

/**
 * Create a new service
 */
export async function createService(service: Partial<Service> & { name: string; business_id: string }): Promise<Service> {
  const supabase = await getWriteClient();
  const { data, error } = await supabase
    .from("services")
    .insert(service as any)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to create service");
  return data as Service;
}

/**
 * Create multiple services at once (bulk action)
 * Spec Part 5: Services with bulk actions
 */
export async function createServices(
  services: (Partial<Service> & { name: string; business_id: string })[]
): Promise<Service[]> {
  const supabase = await getWriteClient();
  const { data, error } = await supabase
    .from("services")
    .insert(services as any[])
    .select();

  if (error) throw error;
  return (data ?? []) as Service[];
}

/**
 * Update a service
 */
export async function updateService(
  id: string,
  updates: Partial<Service>
): Promise<Service> {
  const supabase = await getWriteClient();
  const { data, error } = await supabase
    .from("services")
    .update(updates as any)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to update service");
  return data as Service;
}

/**
 * Delete a service
 */
export async function deleteService(id: string): Promise<void> {
  const supabase = await getWriteClient();
  const { error } = await supabase.from("services").delete().eq("id", id);

  if (error) throw error;
}

/**
 * Delete all services for a business
 */
export async function deleteAllServices(businessId: string): Promise<void> {
  const supabase = await getWriteClient();
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("business_id", businessId);

  if (error) throw error;
}

/**
 * Reorder services (update sort_order)
 */
export async function reorderServices(
  serviceIds: string[]
): Promise<void> {
  const supabase = await getWriteClient();

  // Update each service with its new sort order
  for (let i = 0; i < serviceIds.length; i++) {
    const { error } = await supabase
      .from("services")
      .update({ sort_order: i })
      .eq("id", serviceIds[i]);

    if (error) throw error;
  }
}
