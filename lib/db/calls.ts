/**
 * Database Helpers - Calls and Appointments
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 9, Lines 1053-1130
 */

import { createClient } from "@/lib/supabase/server";
import { sanitizeSqlPattern } from "@/lib/security";
import { logWarning } from "@/lib/logging";
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
  // Sanitize to prevent SQL ILIKE pattern injection
  if (searchQuery) {
    const sanitized = sanitizeSqlPattern(searchQuery);
    query = query.or(`summary.ilike.%${sanitized}%,message_taken.ilike.%${sanitized}%`);
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
 * Date range filter options for dashboard queries
 */
export interface DateRangeFilter {
  from: string; // ISO date string
  to: string;   // ISO date string
}

/**
 * Get call stats for dashboard with date range support
 * Spec Lines 671-674: Today/week calls, appointments, outcome breakdown
 *
 * PERFORMANCE: All queries run in parallel using Promise.all
 */
export async function getCallStats(
  businessId: string,
  dateRange?: DateRangeFilter
): Promise<{
  todayCalls: number;
  weekCalls: number;
  todayAppointments: number;
  weekAppointments: number;
  totalCalls: number;
  totalAppointments: number;
  outcomeBreakdown: {
    booked: number;
    transferred: number;
    info: number;
    message: number;
    missed: number;
    minutes_exhausted: number;
  };
}> {
  const supabase = await getClient();

  // Get current date info (use UTC to avoid timezone issues)
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

  // Calculate start of week (Sunday) in UTC
  const dayOfWeek = now.getUTCDay();
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek)).toISOString();

  // Use date range if provided, otherwise use month start (UTC)
  const rangeStart = dateRange?.from ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const rangeEnd = dateRange?.to ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)).toISOString();

  // Run all queries in parallel
  const [
    todayCallsResult,
    weekCallsResult,
    todayAppointmentsResult,
    weekAppointmentsResult,
    rangeCallsResult,
    rangeAppointmentsResult,
    outcomeResult,
  ] = await Promise.all([
    // Today's calls
    supabase
      .from("calls")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", todayStart),
    // This week's calls
    supabase
      .from("calls")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", weekStart),
    // Today's appointments
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", todayStart),
    // This week's appointments
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", weekStart),
    // Total calls in date range
    supabase
      .from("calls")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", rangeStart)
      .lte("created_at", rangeEnd),
    // Total appointments in date range
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", rangeStart)
      .lte("created_at", rangeEnd),
    // Outcome breakdown for date range
    supabase
      .from("calls")
      .select("outcome")
      .eq("business_id", businessId)
      .gte("created_at", rangeStart)
      .lte("created_at", rangeEnd)
      .not("outcome", "is", null),
  ]);

  // Check for errors
  if (todayCallsResult.error) throw todayCallsResult.error;
  if (weekCallsResult.error) throw weekCallsResult.error;
  if (todayAppointmentsResult.error) throw todayAppointmentsResult.error;
  if (weekAppointmentsResult.error) throw weekAppointmentsResult.error;
  if (rangeCallsResult.error) throw rangeCallsResult.error;
  if (rangeAppointmentsResult.error) throw rangeAppointmentsResult.error;
  if (outcomeResult.error) throw outcomeResult.error;

  // Count outcomes
  const outcomeBreakdown = {
    booked: 0,
    transferred: 0,
    info: 0,
    message: 0,
    missed: 0,
    minutes_exhausted: 0,
  };

  type OutcomeKey = keyof typeof outcomeBreakdown;
  const validOutcomes: OutcomeKey[] = ["booked", "transferred", "info", "message", "missed", "minutes_exhausted"];

  (outcomeResult.data ?? []).forEach((call: { outcome: string }) => {
    if (call.outcome && validOutcomes.includes(call.outcome as OutcomeKey)) {
      outcomeBreakdown[call.outcome as OutcomeKey]++;
    }
  });

  return {
    todayCalls: todayCallsResult.count ?? 0,
    weekCalls: weekCallsResult.count ?? 0,
    todayAppointments: todayAppointmentsResult.count ?? 0,
    weekAppointments: weekAppointmentsResult.count ?? 0,
    totalCalls: rangeCallsResult.count ?? 0,
    totalAppointments: rangeAppointmentsResult.count ?? 0,
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

  const result = data as Appointment;

  // If appointment was created from a call, update the call outcome to "booked"
  // This ensures booking rate stats are accurate
  if (appointment.call_id) {
    await (supabase as any)
      .from("calls")
      .update({ outcome: "booked" })
      .eq("id", appointment.call_id);
  }

  // Dispatch webhook for appointment.created (async, non-blocking)
  import("@/lib/webhooks")
    .then(({ dispatchAppointmentCreated }) => {
      dispatchAppointmentCreated(appointment.business_id, {
        appointment_id: result.id,
        customer_name: result.customer_name ?? undefined,
        customer_phone: result.customer_phone ?? undefined,
        customer_email: result.customer_email ?? undefined,
        service_name: result.service_name ?? undefined,
        scheduled_at: result.scheduled_at ?? undefined,
        duration_minutes: result.duration_minutes ?? undefined,
      }).catch((err) => logWarning("Webhook dispatch failed", `appointment.created: ${err}`));
    })
    .catch((err) => logWarning("Webhook import failed", `appointment.created: ${err}`));

  return result;
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

  // Dispatch webhook for appointment.updated (async, non-blocking)
  // Determine what fields changed
  const changes = Object.keys(updates).filter(
    key => updates[key as keyof AppointmentUpdate] !== undefined
  );

  import("@/lib/webhooks")
    .then(({ dispatchAppointmentUpdated }) => {
      dispatchAppointmentUpdated(data.business_id, {
        appointment_id: data.id,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_email: data.customer_email,
        service_name: data.service_name,
        scheduled_at: data.scheduled_at,
        duration_minutes: data.duration_minutes,
        status: data.status,
        changes,
      }).catch((err) => logWarning("Webhook dispatch failed", `appointment.updated: ${err}`));
    })
    .catch((err) => logWarning("Webhook import failed", `appointment.updated: ${err}`));

  return data as Appointment;
}

/**
 * Cancel an appointment
 * Spec Line 716: Actions: Cancel, Reschedule, Mark complete
 */
export async function cancelAppointment(id: string): Promise<Appointment> {
  const appointment = await updateAppointment(id, { status: "cancelled" });

  // Dispatch webhook for appointment.cancelled (async, non-blocking)
  import("@/lib/webhooks")
    .then(({ dispatchAppointmentCancelled }) => {
      dispatchAppointmentCancelled(appointment.business_id, {
        appointment_id: appointment.id,
        customer_name: appointment.customer_name ?? undefined,
        customer_phone: appointment.customer_phone ?? undefined,
        cancelled_at: new Date().toISOString(),
      }).catch((err) => logWarning("Webhook dispatch failed", `appointment.cancelled: ${err}`));
    })
    .catch((err) => logWarning("Webhook import failed", `appointment.cancelled: ${err}`));

  return appointment;
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
 * Get call trends for date range
 * Returns daily call counts for chart display
 *
 * PERFORMANCE: All day queries run in parallel using Promise.all
 */
export async function getCallTrends(
  businessId: string,
  dateRange?: DateRangeFilter
): Promise<{
  date: string;
  dayLabel: string;
  count: number;
}[]> {
  const supabase = await getClient();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Calculate date range - default to last 7 days
  const endDate = dateRange?.to ? new Date(dateRange.to) : new Date();
  const startDate = dateRange?.from ? new Date(dateRange.from) : new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);

  // Calculate number of days in range
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Build array of date ranges
  const dateRanges: { dateStr: string; dayLabel: string; dayStart: string; dayEnd: string }[] = [];
  for (let i = 0; i < daysDiff; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);

    // Use shorter labels for longer ranges
    const label = daysDiff > 14
      ? `${monthNames[date.getMonth()]} ${date.getDate()}`
      : dayNames[date.getDay()];

    dateRanges.push({
      dateStr: date.toISOString().split("T")[0],
      dayLabel: label,
      dayStart: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString(),
      dayEnd: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)).toISOString(),
    });
  }

  // Run all queries in parallel
  const results = await Promise.all(
    dateRanges.map(({ dayStart, dayEnd }) =>
      supabase
        .from("calls")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId)
        .gte("created_at", dayStart)
        .lt("created_at", dayEnd)
    )
  );

  // Check for errors and build trends array
  return results.map((result, index) => {
    if (result.error) throw result.error;
    return {
      date: dateRanges[index].dateStr,
      dayLabel: dateRanges[index].dayLabel,
      count: result.count ?? 0,
    };
  });
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
 * Get AI performance metrics for dashboard with date range support
 */
export async function getAIPerformance(
  businessId: string,
  dateRange?: DateRangeFilter
): Promise<{
  bookingRate: number;
  avgCallDuration: number;
  successRate: number;
  totalCallsHandled: number;
}> {
  const supabase = await getClient();

  // Use date range if provided, otherwise use current month
  const now = new Date();
  const rangeStart = dateRange?.from ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const rangeEnd = dateRange?.to ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // Get all calls in range
  const { data: calls, error } = await supabase
    .from("calls")
    .select("outcome, duration_seconds")
    .eq("business_id", businessId)
    .gte("created_at", rangeStart)
    .lte("created_at", rangeEnd);

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
 * Get sentiment breakdown for calls this month
 */
export async function getSentimentBreakdown(businessId: string): Promise<{
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}> {
  const supabase = await getClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  try {
    const { data, error } = await supabase
      .from("calls")
      .select("sentiment_detected")
      .eq("business_id", businessId)
      .gte("created_at", monthStart)
      .not("sentiment_detected", "is", null);

    // Handle missing column gracefully
    if (error) {
      if (error.code === "42703") {
        // Column doesn't exist - return empty breakdown
        return { positive: 0, neutral: 0, negative: 0, total: 0 };
      }
      throw error;
    }

    const calls = data ?? [];
    const positive = calls.filter((c: any) => c.sentiment_detected === "pleased").length;
    const neutral = calls.filter((c: any) => c.sentiment_detected === "neutral").length;
    const negative = calls.filter((c: any) =>
      ["frustrated", "upset", "angry"].includes(c.sentiment_detected)
    ).length;

    return {
      positive,
      neutral,
      negative,
      total: calls.length,
    };
  } catch (err: any) {
    // Fallback for any other errors related to missing column
    if (err?.code === "42703" || err?.message?.includes("does not exist")) {
      return { positive: 0, neutral: 0, negative: 0, total: 0 };
    }
    throw err;
  }
}

/**
 * Get language breakdown for calls this month
 */
export async function getLanguageBreakdown(businessId: string): Promise<{
  english: number;
  spanish: number;
  total: number;
}> {
  const supabase = await getClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  try {
    const { data, error } = await supabase
      .from("calls")
      .select("language")
      .eq("business_id", businessId)
      .gte("created_at", monthStart);

    if (error) {
      if (error.code === "42703") {
        return { english: 0, spanish: 0, total: 0 };
      }
      throw error;
    }

    const calls = data ?? [];
    const english = calls.filter((c: any) => c.language === "en").length;
    const spanish = calls.filter((c: any) => c.language === "es").length;

    return {
      english,
      spanish,
      total: calls.length,
    };
  } catch (err: any) {
    if (err?.code === "42703" || err?.message?.includes("does not exist")) {
      return { english: 0, spanish: 0, total: 0 };
    }
    throw err;
  }
}

/**
 * Get peak hours heatmap data (calls by hour of day)
 * Returns call counts for each hour (0-23) over the last 30 days
 */
export async function getPeakHours(businessId: string): Promise<{
  hour: number;
  count: number;
  label: string;
}[]> {
  const supabase = await getClient();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("calls")
    .select("created_at")
    .eq("business_id", businessId)
    .gte("created_at", thirtyDaysAgo);

  if (error) throw error;

  // Initialize hourly counts
  const hourCounts: number[] = new Array(24).fill(0);

  // Count calls by hour
  (data ?? []).forEach((call: any) => {
    const hour = new Date(call.created_at).getHours();
    hourCounts[hour]++;
  });

  // Format hour labels
  const formatHour = (h: number) => {
    if (h === 0) return "12am";
    if (h === 12) return "12pm";
    return h < 12 ? `${h}am` : `${h - 12}pm`;
  };

  return hourCounts.map((count, hour) => ({
    hour,
    count,
    label: formatHour(hour),
  }));
}

/**
 * Get missed call rate
 */
export async function getMissedCallRate(businessId: string): Promise<{
  missed: number;
  total: number;
  rate: number;
}> {
  const supabase = await getClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { data, error } = await supabase
    .from("calls")
    .select("outcome")
    .eq("business_id", businessId)
    .gte("created_at", monthStart);

  if (error) throw error;

  const calls = data ?? [];
  const total = calls.length;
  const missed = calls.filter((c: any) =>
    c.outcome === "missed" || c.outcome === "minutes_exhausted"
  ).length;

  return {
    missed,
    total,
    rate: total > 0 ? Math.round((missed / total) * 100) : 0,
  };
}

/**
 * Get total calls handled this month (for "Calls Handled" metric)
 */
export async function getCallsHandled(businessId: string): Promise<{
  thisMonth: number;
  lastMonth: number;
}> {
  const supabase = await getClient();
  const now = new Date();
  const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();

  const [thisMonthResult, lastMonthResult] = await Promise.all([
    supabase
      .from("calls")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", thisMonthStart),
    supabase
      .from("calls")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", lastMonthStart)
      .lt("created_at", thisMonthStart),
  ]);

  if (thisMonthResult.error) throw thisMonthResult.error;
  if (lastMonthResult.error) throw lastMonthResult.error;

  return {
    thisMonth: thisMonthResult.count ?? 0,
    lastMonth: lastMonthResult.count ?? 0,
  };
}

/**
 * Get period comparison data for dashboard
 * Compares current period to previous period of same length
 *
 * PERFORMANCE: All 4 queries run in parallel using Promise.all
 */
export async function getWeeklyComparison(
  businessId: string,
  dateRange?: DateRangeFilter
): Promise<{
  thisWeekCalls: number;
  lastWeekCalls: number;
  thisWeekAppointments: number;
  lastWeekAppointments: number;
  periodLabel: string;
}> {
  const supabase = await getClient();
  const now = new Date();

  let currentStart: Date;
  let currentEnd: Date;
  let previousStart: Date;
  let previousEnd: Date;
  let periodLabel = "This Week vs Last";

  if (dateRange?.from && dateRange?.to) {
    // Calculate period based on date range
    currentStart = new Date(dateRange.from);
    currentEnd = new Date(dateRange.to);
    const periodLength = currentEnd.getTime() - currentStart.getTime();

    previousEnd = new Date(currentStart.getTime() - 1); // Day before current start
    previousStart = new Date(previousEnd.getTime() - periodLength);

    // Calculate days for label
    const days = Math.ceil(periodLength / (1000 * 60 * 60 * 24));
    periodLabel = days === 1 ? "Today vs Yesterday" : `Last ${days}d vs Prior`;
  } else {
    // Default to week comparison (use UTC)
    const dayOfWeek = now.getUTCDay();
    currentStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOfWeek));
    currentEnd = now;

    previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - 7);
    previousEnd = new Date(currentStart.getTime() - 1);
  }

  const currentStartISO = currentStart.toISOString();
  const currentEndISO = currentEnd.toISOString();
  const previousStartISO = previousStart.toISOString();
  const previousEndISO = previousEnd.toISOString();

  // Run all 4 queries in parallel
  const [
    thisWeekCallsResult,
    lastWeekCallsResult,
    thisWeekAppointmentsResult,
    lastWeekAppointmentsResult,
  ] = await Promise.all([
    // Current period calls
    supabase
      .from("calls")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", currentStartISO)
      .lte("created_at", currentEndISO),
    // Previous period calls
    supabase
      .from("calls")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", previousStartISO)
      .lte("created_at", previousEndISO),
    // Current period appointments
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", currentStartISO)
      .lte("created_at", currentEndISO),
    // Previous period appointments
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gte("created_at", previousStartISO)
      .lte("created_at", previousEndISO),
  ]);

  // Check for errors
  if (thisWeekCallsResult.error) throw thisWeekCallsResult.error;
  if (lastWeekCallsResult.error) throw lastWeekCallsResult.error;
  if (thisWeekAppointmentsResult.error) throw thisWeekAppointmentsResult.error;
  if (lastWeekAppointmentsResult.error) throw lastWeekAppointmentsResult.error;

  return {
    thisWeekCalls: thisWeekCallsResult.count ?? 0,
    lastWeekCalls: lastWeekCallsResult.count ?? 0,
    thisWeekAppointments: thisWeekAppointmentsResult.count ?? 0,
    lastWeekAppointments: lastWeekAppointmentsResult.count ?? 0,
    periodLabel,
  };
}
