/**
 * Database Helpers - Calls and Appointments
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 9, Lines 1053-1130
 */

import { createClient } from "@/lib/supabase/server";
import type { Call, CallOutcome, CallLanguage, Appointment, AppointmentStatus } from "@/types";

/**
 * Helper to get a Supabase client
 */
async function getClient() {
  return createClient();
}

// =============================================================================
// Call Types for Insert/Update
// =============================================================================

export interface CallInsert {
  id?: string;
  business_id: string;
  retell_call_id?: string | null;
  from_number?: string | null;
  to_number?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number | null;
  duration_minutes_billed?: number | null;
  language?: CallLanguage;
  recording_url?: string | null;
  transcript?: Record<string, unknown> | null;
  summary?: string | null;
  outcome?: CallOutcome | null;
  lead_info?: Record<string, unknown> | null;
  message_taken?: string | null;
  cost_cents?: number | null;
}

export interface CallUpdate {
  retell_call_id?: string | null;
  from_number?: string | null;
  to_number?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number | null;
  duration_minutes_billed?: number | null;
  language?: CallLanguage;
  recording_url?: string | null;
  transcript?: Record<string, unknown> | null;
  summary?: string | null;
  outcome?: CallOutcome | null;
  lead_info?: Record<string, unknown> | null;
  message_taken?: string | null;
  cost_cents?: number | null;
  flagged?: boolean;
  notes?: string | null;
}

export interface AppointmentInsert {
  id?: string;
  business_id: string;
  call_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  service_id?: string | null;
  service_name?: string | null;
  scheduled_at?: string | null;
  duration_minutes?: number | null;
  status?: AppointmentStatus;
  notes?: string | null;
  external_event_id?: string | null;
  confirmation_sent_at?: string | null;
  reminder_sent_at?: string | null;
}

export interface AppointmentUpdate {
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  service_id?: string | null;
  service_name?: string | null;
  scheduled_at?: string | null;
  duration_minutes?: number | null;
  status?: AppointmentStatus;
  notes?: string | null;
  external_event_id?: string | null;
  confirmation_sent_at?: string | null;
  reminder_sent_at?: string | null;
}

// =============================================================================
// Call Query Filters
// =============================================================================

export interface CallFilters {
  startDate?: string;
  endDate?: string;
  outcome?: CallOutcome;
  language?: CallLanguage;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

// =============================================================================
// Call Helpers (Spec Lines 1053-1085)
// =============================================================================

/**
 * Get all calls for a business with optional filters
 * Spec Lines 678-699: Calls list with filters
 */
export async function getCallsByBusinessId(
  businessId: string,
  filters: CallFilters = {}
): Promise<{ calls: Call[]; total: number }> {
  const supabase = await getClient();
  const { startDate, endDate, outcome, language, searchQuery, limit = 50, offset = 0 } = filters;

  let query = supabase
    .from("calls")
    .select("*", { count: "exact" })
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  // Apply date filters
  if (startDate) {
    query = query.gte("created_at", startDate);
  }
  if (endDate) {
    query = query.lte("created_at", endDate);
  }

  // Apply outcome filter
  if (outcome) {
    query = query.eq("outcome", outcome);
  }

  // Apply language filter
  if (language) {
    query = query.eq("language", language);
  }

  // Apply search filter (searches in summary and message_taken)
  if (searchQuery) {
    query = query.or(`summary.ilike.%${searchQuery}%,message_taken.ilike.%${searchQuery}%`);
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw error;
  return { calls: (data ?? []) as Call[], total: count ?? 0 };
}

/**
 * Get recent calls for dashboard
 * Spec Line 675: Recent calls list (last 5-10)
 */
export async function getRecentCalls(
  businessId: string,
  limit: number = 10
): Promise<Call[]> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Call[];
}

/**
 * Get a single call by ID
 */
export async function getCallById(id: string): Promise<Call | null> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as Call | null;
}

/**
 * Get a call by Retell call ID
 */
export async function getCallByRetellId(retellCallId: string): Promise<Call | null> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("calls")
    .select("*")
    .eq("retell_call_id", retellCallId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as Call | null;
}

/**
 * Create a new call record
 */
export async function createCall(call: CallInsert): Promise<Call> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("calls")
    .insert(call as any)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to create call");
  return data as Call;
}

/**
 * Update a call record
 */
export async function updateCall(id: string, updates: CallUpdate): Promise<Call> {
  const supabase = await getClient();
  const { data, error } = await (supabase as any)
    .from("calls")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to update call");
  return data as Call;
}

/**
 * Flag a call
 * Spec Line 692: Actions: Flag, Add note
 */
export async function flagCall(id: string, flagged: boolean): Promise<Call> {
  return updateCall(id, { flagged });
}

/**
 * Add note to a call
 * Spec Line 692: Actions: Flag, Add note
 */
export async function addCallNote(id: string, notes: string): Promise<Call> {
  return updateCall(id, { notes });
}

// =============================================================================
// Dashboard Stats Helpers
// =============================================================================

/**
 * Get call stats for dashboard
 * Spec Lines 671-674: Today/week calls, appointments, outcome breakdown
 */
export async function getCallStats(businessId: string): Promise<{
  todayCalls: number;
  weekCalls: number;
  todayAppointments: number;
  weekAppointments: number;
  outcomeBreakdown: Record<string, number>;
}> {
  const supabase = await getClient();
  
  // Get current date info
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  
  // Calculate start of week (Sunday)
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).toISOString();

  // Get today's calls
  const { count: todayCalls, error: todayError } = await supabase
    .from("calls")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", todayStart);

  if (todayError) throw todayError;

  // Get this week's calls
  const { count: weekCalls, error: weekError } = await supabase
    .from("calls")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", weekStart);

  if (weekError) throw weekError;

  // Get today's appointments
  const { count: todayAppointments, error: todayApptError } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", todayStart);

  if (todayApptError) throw todayApptError;

  // Get this week's appointments
  const { count: weekAppointments, error: weekApptError } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", weekStart);

  if (weekApptError) throw weekApptError;

  // Get outcome breakdown for this month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { data: outcomeData, error: outcomeError } = await supabase
    .from("calls")
    .select("outcome")
    .eq("business_id", businessId)
    .gte("created_at", monthStart)
    .not("outcome", "is", null);

  if (outcomeError) throw outcomeError;

  // Count outcomes
  const outcomeBreakdown: Record<string, number> = {
    booked: 0,
    transferred: 0,
    info: 0,
    message: 0,
    missed: 0,
    minutes_exhausted: 0,
  };

  (outcomeData ?? []).forEach((call: { outcome: string }) => {
    if (call.outcome && outcomeBreakdown.hasOwnProperty(call.outcome)) {
      outcomeBreakdown[call.outcome]++;
    }
  });

  return {
    todayCalls: todayCalls ?? 0,
    weekCalls: weekCalls ?? 0,
    todayAppointments: todayAppointments ?? 0,
    weekAppointments: weekAppointments ?? 0,
    outcomeBreakdown,
  };
}

/**
 * Get minutes usage for dashboard
 * Spec Lines 594-606: Minutes display
 */
export async function getMinutesUsage(businessId: string): Promise<{
  used: number;
  included: number;
  percentage: number;
  estimatedCalls: number;
  daysUntilReset: number;
  colorLevel: "green" | "yellow" | "orange" | "red";
}> {
  const supabase = await getClient();
  
  const { data: business, error } = await supabase
    .from("businesses")
    .select("minutes_used_this_cycle, minutes_included, current_cycle_end")
    .eq("id", businessId)
    .single();

  if (error) throw error;
  if (!business) throw new Error("Business not found");

  // Type assertion for the business data
  const businessData = business as {
    minutes_used_this_cycle: number | null;
    minutes_included: number | null;
    current_cycle_end: string | null;
  };

  const used = businessData.minutes_used_this_cycle ?? 0;
  const included = businessData.minutes_included ?? 200;
  const percentage = included > 0 ? Math.round((used / included) * 100) : 0;
  
  // Estimate calls based on 5 min average
  const estimatedCalls = Math.round(used / 5);
  
  // Calculate days until reset
  const cycleEnd = businessData.current_cycle_end 
    ? new Date(businessData.current_cycle_end) 
    : new Date();
  const now = new Date();
  const daysUntilReset = Math.max(0, Math.ceil((cycleEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  // Determine color level per spec Line 669
  let colorLevel: "green" | "yellow" | "orange" | "red" = "green";
  if (percentage >= 95) {
    colorLevel = "red";
  } else if (percentage >= 80) {
    colorLevel = "orange";
  } else if (percentage >= 50) {
    colorLevel = "yellow";
  }

  return {
    used,
    included,
    percentage,
    estimatedCalls,
    daysUntilReset,
    colorLevel,
  };
}

// =============================================================================
// Appointment Helpers (Spec Lines 1111-1130)
// =============================================================================

/**
 * Get appointments for a business
 */
export async function getAppointmentsByBusinessId(
  businessId: string,
  options: {
    upcoming?: boolean;
    past?: boolean;
    status?: AppointmentStatus;
    limit?: number;
  } = {}
): Promise<Appointment[]> {
  const supabase = await getClient();
  const { upcoming, past, status, limit = 50 } = options;

  let query = supabase
    .from("appointments")
    .select("*")
    .eq("business_id", businessId)
    .order("scheduled_at", { ascending: upcoming ?? true });

  const now = new Date().toISOString();

  if (upcoming) {
    query = query.gte("scheduled_at", now);
  }
  if (past) {
    query = query.lt("scheduled_at", now);
  }
  if (status) {
    query = query.eq("status", status);
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as Appointment[];
}

/**
 * Get appointment by ID
 */
export async function getAppointmentById(id: string): Promise<Appointment | null> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as Appointment | null;
}

/**
 * Get appointment by call ID
 * Spec Line 691: Appointment booked (if any)
 */
export async function getAppointmentByCallId(callId: string): Promise<Appointment | null> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("call_id", callId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as Appointment | null;
}

/**
 * Create a new appointment
 */
export async function createAppointment(appointment: AppointmentInsert): Promise<Appointment> {
  const supabase = await getClient();
  const { data, error } = await supabase
    .from("appointments")
    .insert(appointment as any)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to create appointment");
  return data as Appointment;
}

/**
 * Update an appointment
 */
export async function updateAppointment(
  id: string,
  updates: AppointmentUpdate
): Promise<Appointment> {
  const supabase = await getClient();
  const { data, error } = await (supabase as any)
    .from("appointments")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to update appointment");
  return data as Appointment;
}

/**
 * Cancel an appointment
 * Spec Line 716: Actions: Cancel, Reschedule, Mark complete
 */
export async function cancelAppointment(id: string): Promise<Appointment> {
  return updateAppointment(id, { status: "cancelled" });
}

/**
 * Complete an appointment
 * Spec Line 716: Actions: Cancel, Reschedule, Mark complete
 */
export async function completeAppointment(id: string): Promise<Appointment> {
  return updateAppointment(id, { status: "completed" });
}

/**
 * Mark appointment as no-show
 */
export async function markAppointmentNoShow(id: string): Promise<Appointment> {
  return updateAppointment(id, { status: "no_show" });
}

// =============================================================================
// Dashboard Enhancement Helpers
// =============================================================================

/**
 * Get call trends for last 7 days
 * Returns daily call counts for chart display
 */
export async function getCallTrends(businessId: string): Promise<{
  date: string;
  dayLabel: string;
  calls: number;
}[]> {
  const supabase = await getClient();
  const trends: { date: string; dayLabel: string; calls: number }[] = [];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();

    const { count, error } = await supabase
      .from("calls")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", dayStart)
      .lt("created_at", dayEnd);

    if (error) throw error;

    trends.push({
      date: dateStr,
      dayLabel: dayNames[date.getDay()],
      calls: count ?? 0,
    });
  }

  return trends;
}

/**
 * Get upcoming appointments for dashboard widget
 */
export async function getUpcomingAppointmentsForWidget(
  businessId: string,
  limit: number = 5
): Promise<{
  id: string;
  customerName: string;
  serviceName: string;
  scheduledAt: string;
  status: AppointmentStatus;
}[]> {
  const supabase = await getClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("appointments")
    .select("id, customer_name, service_name, scheduled_at, status")
    .eq("business_id", businessId)
    .gte("scheduled_at", now)
    .in("status", ["confirmed", "pending"])
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((apt: any) => ({
    id: apt.id,
    customerName: apt.customer_name ?? "Unknown",
    serviceName: apt.service_name ?? "Appointment",
    scheduledAt: apt.scheduled_at,
    status: apt.status,
  }));
}

/**
 * Get AI performance metrics for dashboard
 */
export async function getAIPerformance(businessId: string): Promise<{
  bookingRate: number;
  avgCallDuration: number;
  successRate: number;
  totalCallsHandled: number;
}> {
  const supabase = await getClient();

  // Get start of current month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Get all calls this month
  const { data: calls, error } = await supabase
    .from("calls")
    .select("outcome, duration_seconds")
    .eq("business_id", businessId)
    .gte("created_at", monthStart);

  if (error) throw error;

  const callData = calls ?? [];
  const totalCalls = callData.length;

  if (totalCalls === 0) {
    return {
      bookingRate: 0,
      avgCallDuration: 0,
      successRate: 0,
      totalCallsHandled: 0,
    };
  }

  // Calculate booking rate
  const bookedCalls = callData.filter((c: any) => c.outcome === "booked").length;
  const bookingRate = Math.round((bookedCalls / totalCalls) * 100);

  // Calculate average duration
  const totalDuration = callData.reduce((sum: number, c: any) => sum + (c.duration_seconds ?? 0), 0);
  const avgCallDuration = Math.round(totalDuration / totalCalls);

  // Calculate success rate (booked, transferred, info are positive outcomes)
  const successfulCalls = callData.filter((c: any) =>
    ["booked", "transferred", "info"].includes(c.outcome)
  ).length;
  const successRate = Math.round((successfulCalls / totalCalls) * 100);

  return {
    bookingRate,
    avgCallDuration,
    successRate,
    totalCallsHandled: totalCalls,
  };
}

/**
 * Get weekly comparison stats
 */
export async function getWeeklyComparison(businessId: string): Promise<{
  thisWeekCalls: number;
  lastWeekCalls: number;
  thisWeekAppointments: number;
  lastWeekAppointments: number;
}> {
  const supabase = await getClient();

  const now = new Date();
  const dayOfWeek = now.getDay();

  // This week start (Sunday)
  const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).toISOString();

  // Last week start and end
  const lastWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek - 7).toISOString();
  const lastWeekEnd = thisWeekStart;

  // This week calls
  const { count: thisWeekCalls, error: twcError } = await supabase
    .from("calls")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", thisWeekStart);

  if (twcError) throw twcError;

  // Last week calls
  const { count: lastWeekCalls, error: lwcError } = await supabase
    .from("calls")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", lastWeekStart)
    .lt("created_at", lastWeekEnd);

  if (lwcError) throw lwcError;

  // This week appointments
  const { count: thisWeekAppointments, error: twaError } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", thisWeekStart);

  if (twaError) throw twaError;

  // Last week appointments
  const { count: lastWeekAppointments, error: lwaError } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("business_id", businessId)
    .gte("created_at", lastWeekStart)
    .lt("created_at", lastWeekEnd);

  if (lwaError) throw lwaError;

  return {
    thisWeekCalls: thisWeekCalls ?? 0,
    lastWeekCalls: lastWeekCalls ?? 0,
    thisWeekAppointments: thisWeekAppointments ?? 0,
    lastWeekAppointments: lastWeekAppointments ?? 0,
  };
}
