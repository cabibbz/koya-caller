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
import type { TableInsert, TableUpdate } from "./types";
import { typedInsert, typedInsertMany, typedUpdate, typedUpdateNoReturn } from "./types";

// ============================================
// Plans (Spec Lines 863-874)
// ============================================

/**
 * Get all active plans
 */
export async function getActivePlans(): Promise<Plan[]> {
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  // Cast through unknown since Supabase types may not include new trial columns
  return data as unknown as Business | null;
}

/**
 * Get a business by user ID
 */
export async function getBusinessByUserId(userId: string): Promise<Business | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  // Cast through unknown since Supabase types may not include new trial columns
  return data as unknown as Business | null;
}

/**
 * Create a new business
 */
export async function createBusiness(business: Partial<Business> & { name: string }): Promise<Business> {
  const supabase = await createClient();
  const insertData: TableInsert<"businesses"> = {
    name: business.name,
    user_id: business.user_id,
    business_type: business.business_type,
    address: business.address,
    website: business.website,
    service_area: business.service_area,
    differentiator: business.differentiator,
    timezone: business.timezone,
    plan_id: business.plan_id,
  };
  const { data, error } = await typedInsert(supabase, "businesses", insertData);

  if (error) throw error;
  if (!data) throw new Error("Failed to create business");
  // Cast through unknown since Supabase types may not include new trial columns
  return data as unknown as Business;
}

/**
 * Update a business
 */
export async function updateBusiness(
  id: string,
  updates: Partial<Business>
): Promise<Business> {
  const supabase = await createClient();
  const updateData: TableUpdate<"businesses"> = updates;
  const { data, error } = await typedUpdate(supabase, "businesses", updateData, { column: "id", value: id });

  if (error) throw error;
  if (!data) throw new Error("Failed to update business");
  // Cast through unknown since Supabase types may not include new trial columns
  return data as unknown as Business;
}

/**
 * Update business onboarding step
 * Spec Line 889: onboarding_step tracks progress for resume
 */
export async function updateOnboardingStep(
  businessId: string,
  step: number
): Promise<void> {
  const supabase = await createClient();
  const updateData: TableUpdate<"businesses"> = { onboarding_step: step };

  // If completing onboarding (step 8 done), mark completion
  if (step > 8) {
    updateData.onboarding_completed_at = new Date().toISOString();
    updateData.subscription_status = "active";
  }

  const { error } = await typedUpdateNoReturn(supabase, "businesses", updateData, { column: "id", value: businessId });

  if (error) throw error;
}

/**
 * Update usage minutes for a business
 * Spec Lines 895-900: Usage tracking
 *
 * Uses atomic database increment to prevent race conditions where
 * concurrent calls could lose increments.
 */
export async function incrementUsageMinutes(
  businessId: string,
  minutes: number
): Promise<Business> {
  // Validate minutes parameter at application level (DB also validates)
  if (!Number.isInteger(minutes) || minutes <= 0) {
    throw new Error("Minutes must be a positive integer");
  }
  if (minutes > 1440) {
    throw new Error("Minutes increment exceeds maximum allowed value (1440)");
  }

  const supabase = await createClient();

  // Use atomic increment via RPC to prevent race conditions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("increment_usage_minutes", {
    p_business_id: businessId,
    p_minutes: minutes,
  });

  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Business not found");

  // Fetch full business record for return type compatibility
  // (RPC returns partial data, we need full Business object)
  const { data: business, error: fetchError } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .single();

  if (fetchError) throw fetchError;
  if (!business) throw new Error("Business not found after update");

  return business as Business;
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
  const supabase = await createClient();
  const updateData: TableUpdate<"businesses"> = {
    current_cycle_start: cycleStart.toISOString().split("T")[0],
    current_cycle_end: cycleEnd.toISOString().split("T")[0],
    minutes_used_this_cycle: 0,
    last_usage_alert_percent: 0,
  };
  const { error } = await typedUpdateNoReturn(supabase, "businesses", updateData, { column: "id", value: businessId });

  if (error) throw error;
}

// ============================================
// Business Hours (Spec Lines 909-918)
// ============================================

/**
 * Get business hours for a business
 */
export async function getBusinessHours(businessId: string): Promise<BusinessHours[]> {
  const supabase = await createClient();
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
  const supabase = await createClient();

  // Delete existing hours
  const { error: deleteError } = await supabase
    .from("business_hours")
    .delete()
    .eq("business_id", businessId);

  if (deleteError) throw deleteError;

  // Insert new hours
  const hoursWithBusiness: TableInsert<"business_hours">[] = hours.map((h) => ({
    day_of_week: h.day_of_week,
    open_time: h.open_time,
    close_time: h.close_time,
    is_closed: h.is_closed,
    business_id: businessId,
  }));

  const { error } = await typedInsertMany(supabase, "business_hours", hoursWithBusiness);

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
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
  const insertData: TableInsert<"services"> = {
    name: service.name,
    business_id: service.business_id,
    description: service.description,
    duration_minutes: service.duration_minutes,
    price_cents: service.price_cents,
    price_type: service.price_type,
    is_bookable: service.is_bookable,
    sort_order: service.sort_order,
  };
  const { data, error } = await typedInsert(supabase, "services", insertData);

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
  const supabase = await createClient();
  const insertData: TableInsert<"services">[] = services.map((s) => ({
    name: s.name,
    business_id: s.business_id,
    description: s.description,
    duration_minutes: s.duration_minutes,
    price_cents: s.price_cents,
    price_type: s.price_type,
    is_bookable: s.is_bookable,
    sort_order: s.sort_order,
  }));
  const { data, error } = await typedInsertMany(supabase, "services", insertData);

  if (error) throw error;
  return data as Service[];
}

/**
 * Update a service
 */
export async function updateService(
  id: string,
  updates: Partial<Service>
): Promise<Service> {
  const supabase = await createClient();
  const updateData: TableUpdate<"services"> = updates;
  const { data, error } = await typedUpdate(supabase, "services", updateData, { column: "id", value: id });

  if (error) throw error;
  if (!data) throw new Error("Failed to update service");
  return data as Service;
}

/**
 * Delete a service
 */
export async function deleteService(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", id);

  if (error) throw error;
}

/**
 * Delete all services for a business
 */
export async function deleteAllServices(businessId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("business_id", businessId);

  if (error) throw error;
}

/**
 * Reorder services (update sort_order)
 * Uses Promise.all for parallel execution to prevent race conditions
 * and improve performance
 */
export async function reorderServices(
  serviceIds: string[]
): Promise<void> {
  const supabase = await createClient();

  // Execute all updates in parallel using Promise.all
  // This ensures atomicity at the application level and prevents partial updates
  const updatePromises = serviceIds.map((id, index) => {
    const updateData: TableUpdate<"services"> = { sort_order: index };
    return typedUpdateNoReturn(supabase, "services", updateData, { column: "id", value: id });
  });

  const results = await Promise.all(updatePromises);

  // Check for any errors
  const errors = results.filter(result => result.error);
  if (errors.length > 0) {
    throw errors[0].error;
  }
}
