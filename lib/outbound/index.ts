/**
 * Koya Caller - Outbound Calling Library
 * Core functions for initiating and managing outbound calls
 *
 * Features:
 * - Initiate outbound calls via Retell
 * - Schedule reminder calls
 * - Process call queue
 * - DNC (Do-Not-Call) list management
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createOutboundCall, getRetellClient, isRetellConfigured, verifyRetellPhoneNumber } from "@/lib/retell";
import { prepareDynamicVariables } from "@/lib/retell/functions";
import { logError, logInfo, logWarning } from "@/lib/logging";
import { DateTime } from "luxon";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { } from "@/types/supabase";

// =============================================================================
// Type helper for Phase 3 tables not yet in generated types
// =============================================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

// =============================================================================
// Types
// =============================================================================

export interface OutboundCallOptions {
  /** Purpose of the call */
  purpose: "reminder" | "followup" | "custom";
  /** Custom message for the call */
  customMessage?: string;
  /** Appointment ID if this is a reminder call */
  appointmentId?: string;
  /** Additional metadata */
  metadata?: Record<string, string>;
  /** Dynamic variables for Retell */
  dynamicVariables?: Record<string, string>;
}

export interface OutboundCallResult {
  success: boolean;
  callId?: string;
  retellCallId?: string;
  error?: string;
  reason?: "dnc" | "outside_hours" | "daily_limit" | "invalid_number" | "api_error" | "no_agent" | "consent_required";
  /** Missing consent types when reason is "consent_required" */
  missingConsents?: string[];
}

export interface QueuedCall {
  id: string;
  business_id: string;
  campaign_id: string | null;
  appointment_id: string | null;
  contact_phone: string;
  contact_name: string | null;
  dynamic_variables: Record<string, unknown> | null;
  priority: number;
  status: "pending" | "scheduled" | "calling" | "completed" | "failed" | "cancelled" | "dnc_blocked";
  scheduled_for: string | null;
  attempt_count: number;
  max_attempts: number;
  last_attempt_at: string | null;
  last_error: string | null;
  call_id: string | null;
  retell_call_id: string | null;
  outcome: string | null;
  created_at: string;
  updated_at: string;
}

export interface DNCEntry {
  id: string;
  business_id: string;
  phone_number: string;
  reason: "customer_request" | "complaint" | "legal" | "bounced" | "other" | null;
  source: string | null;
  notes: string | null;
  added_by: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface OutboundSettings {
  outbound_enabled: boolean;
  reminder_calls_enabled: boolean;
  reminder_call_24hr: boolean;
  reminder_call_2hr: boolean;
  reminder_call_agent_id: string | null;
  reminder_call_from_number: string | null;
  outbound_daily_limit: number;
  outbound_hours_start: string; // HH:MM format
  outbound_hours_end: string;
  outbound_days: number[]; // 0-6, Sunday = 0
  outbound_timezone: string;
  calls_made_today: number;
  last_reset_date: string | null;
}

// =============================================================================
// Outbound Hours Check
// =============================================================================

/**
 * Check if current time is within business outbound hours
 */
export async function isWithinOutboundHours(
  businessId: string,
  supabase?: AnySupabaseClient
): Promise<boolean> {
  const client = (supabase || createAdminClient()) as AnySupabaseClient;

  // Get business timezone and outbound settings
  const [businessResult, settingsResult] = await Promise.all([
    client
      .from("businesses")
      .select("timezone")
      .eq("id", businessId)
      .single(),
    client
      .from("outbound_settings")
      .select("outbound_hours_start, outbound_hours_end, outbound_days, outbound_timezone")
      .eq("business_id", businessId)
      .single(),
  ]);

  if (businessResult.error || !businessResult.data) {
    logWarning("Outbound Hours", `Business not found: ${businessId}`);
    return false;
  }

  // Default hours if no settings
  const settings = settingsResult.data || {
    outbound_hours_start: "09:00",
    outbound_hours_end: "18:00",
    outbound_days: [1, 2, 3, 4, 5], // Mon-Fri
    outbound_timezone: "America/New_York",
  };

  const timezone = settings.outbound_timezone || businessResult.data.timezone || "America/New_York";
  const now = DateTime.now().setZone(timezone);

  // Check if today is an allowed day
  const dayOfWeek = now.weekday % 7; // Convert to 0-6 (Sunday = 0)
  if (!settings.outbound_days.includes(dayOfWeek)) {
    return false;
  }

  // Check if current time is within hours
  const currentTime = now.toFormat("HH:mm");
  const startTime = typeof settings.outbound_hours_start === 'string'
    ? settings.outbound_hours_start.substring(0, 5)
    : "09:00";
  const endTime = typeof settings.outbound_hours_end === 'string'
    ? settings.outbound_hours_end.substring(0, 5)
    : "18:00";
  return currentTime >= startTime && currentTime <= endTime;
}

// =============================================================================
// Daily Limit Check
// =============================================================================

/**
 * Check if business has exceeded daily outbound call limit
 */
export async function checkDailyLimit(
  businessId: string,
  supabase?: AnySupabaseClient
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const client = (supabase || createAdminClient()) as AnySupabaseClient;

  // Get settings and business timezone
  const { data: settings } = await client
    .from("outbound_settings")
    .select("outbound_daily_limit, calls_made_today, last_reset_date, outbound_timezone")
    .eq("business_id", businessId)
    .single();

  if (!settings) {
    // Default limit if no settings
    return { allowed: true, used: 0, limit: 100 };
  }

  // Reset counter if it's a new day in the business timezone
  const timezone = settings.outbound_timezone || "America/New_York";
  const today = DateTime.now().setZone(timezone).toISODate();
  let callsMadeToday = settings.calls_made_today || 0;

  if (settings.last_reset_date !== today) {
    // Reset the counter
    await client
      .from("outbound_settings")
      .update({
        calls_made_today: 0,
        last_reset_date: today,
      })
      .eq("business_id", businessId);
    callsMadeToday = 0;
  }

  return {
    allowed: callsMadeToday < (settings.outbound_daily_limit || 100),
    used: callsMadeToday,
    limit: settings.outbound_daily_limit || 100,
  };
}

// =============================================================================
// DNC (Do-Not-Call) Management
// =============================================================================

/**
 * Check if a phone number is on the DNC list
 */
export async function checkDNC(
  businessId: string,
  phone: string,
  supabase?: AnySupabaseClient
): Promise<boolean> {
  const client = (supabase || createAdminClient()) as AnySupabaseClient;

  // Normalize phone number to E.164
  const normalizedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;

  const { data } = await client
    .from("dnc_list")
    .select("id, expires_at")
    .eq("business_id", businessId)
    .eq("phone_number", normalizedPhone)
    .single();

  // Check if entry exists and is not expired
  if (!data) {
    return false;
  }

  // If expires_at is NULL, it's permanent DNC
  if (!data.expires_at) {
    return true;
  }

  // Check if not expired
  return new Date(data.expires_at) > new Date();
}

/**
 * Add a phone number to the DNC list
 */
export async function addToDNC(
  businessId: string,
  phone: string,
  reason: "customer_request" | "complaint" | "legal" | "bounced" | "other",
  addedBy?: string,
  supabase?: AnySupabaseClient
): Promise<{ success: boolean; error?: string }> {
  const client = (supabase || createAdminClient()) as AnySupabaseClient;

  // Normalize phone number to E.164
  const normalizedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;

  // Use the add_to_dnc function which handles upsert and cancels pending calls
  const { data: _data, error } = await client.rpc("add_to_dnc", {
    p_business_id: businessId,
    p_phone: normalizedPhone,
    p_reason: reason,
    p_source: "api",
    p_notes: null,
    p_added_by: addedBy || null,
    p_expires_at: null, // Permanent
  });

  if (error) {
    logError("DNC Add", error);
    return { success: false, error: "Failed to add to DNC list" };
  }

  logInfo("DNC Add", `Added ${normalizedPhone} to DNC for business ${businessId}`);
  return { success: true };
}

/**
 * Remove a phone number from the DNC list
 */
export async function removeFromDNC(
  businessId: string,
  phone: string,
  supabase?: AnySupabaseClient
): Promise<{ success: boolean; error?: string }> {
  const client = (supabase || createAdminClient()) as AnySupabaseClient;

  // Normalize phone number to E.164
  const normalizedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;

  // Delete from DNC list (or set expires_at to now to expire it)
  const { error } = await client
    .from("dnc_list")
    .delete()
    .eq("business_id", businessId)
    .eq("phone_number", normalizedPhone);

  if (error) {
    logError("DNC Remove", error);
    return { success: false, error: "Failed to remove from DNC list" };
  }

  logInfo("DNC Remove", `Removed ${normalizedPhone} from DNC for business ${businessId}`);
  return { success: true };
}

/**
 * Get DNC list entries for a business with pagination
 */
export async function getDNCList(
  businessId: string,
  options: { limit?: number; offset?: number; search?: string } = {},
  supabase?: AnySupabaseClient
): Promise<{ entries: DNCEntry[]; total: number }> {
  const client = (supabase || await createClient()) as AnySupabaseClient;
  const { limit = 50, offset = 0, search } = options;

  let query = client
    .from("dnc_list")
    .select("*", { count: "exact" })
    .eq("business_id", businessId)
    .or("expires_at.is.null,expires_at.gt.now()") // Active entries only
    .order("created_at", { ascending: false });

  if (search) {
    query = query.ilike("phone_number", `%${search}%`);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    logError("DNC List", error);
    return { entries: [], total: 0 };
  }

  return {
    entries: (data || []) as DNCEntry[],
    total: count || 0,
  };
}

// =============================================================================
// Initiate Outbound Call
// =============================================================================

/**
 * Initiate an outbound call via Retell
 */
export async function initiateOutboundCall(
  businessId: string,
  toNumber: string,
  options: OutboundCallOptions
): Promise<OutboundCallResult> {
  const supabase = createAdminClient() as AnySupabaseClient;

  // Normalize phone number - strip non-digits except leading +
  let normalizedTo = toNumber.replace(/[^\d+]/g, "");

  // Add + if missing, assume US if just 10 digits
  if (!normalizedTo.startsWith("+")) {
    if (normalizedTo.length === 10) {
      normalizedTo = `+1${normalizedTo}`;
    } else if (normalizedTo.length === 11 && normalizedTo.startsWith("1")) {
      normalizedTo = `+${normalizedTo}`;
    } else {
      normalizedTo = `+${normalizedTo}`;
    }
  }

  // Validate phone number format (must be + followed by 10-15 digits)
  if (!/^\+\d{10,15}$/.test(normalizedTo)) {
    return { success: false, error: `Invalid phone number format: ${normalizedTo}`, reason: "invalid_number" };
  }

  // Check DNC list
  const isDNC = await checkDNC(businessId, normalizedTo, supabase as AnySupabaseClient);
  if (isDNC) {
    return { success: false, error: "Number is on Do-Not-Call list", reason: "dnc" };
  }

  // Check outbound hours
  const withinHours = await isWithinOutboundHours(businessId, supabase as AnySupabaseClient);
  if (!withinHours) {
    return { success: false, error: "Outside of outbound calling hours", reason: "outside_hours" };
  }

  // Check daily limit
  const limitCheck = await checkDailyLimit(businessId, supabase as AnySupabaseClient);
  if (!limitCheck.allowed) {
    return {
      success: false,
      error: `Daily limit of ${limitCheck.limit} calls reached`,
      reason: "daily_limit",
    };
  }

  // Get business data, phone number, and call settings
  const [businessResult, phoneResult, aiConfigResult, callSettingsResult] = await Promise.all([
    supabase
      .from("businesses")
      .select("name, timezone")
      .eq("id", businessId)
      .single(),
    supabase
      .from("phone_numbers")
      .select("number, twilio_sid")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .limit(1)
      .single(),
    supabase
      .from("ai_config")
      .select("retell_agent_id, ai_name, spanish_enabled, language_mode")
      .eq("business_id", businessId)
      .single(),
    supabase
      .from("call_settings")
      .select("transfer_number, backup_transfer_number")
      .eq("business_id", businessId)
      .single(),
  ]);

  if (businessResult.error || !businessResult.data) {
    return { success: false, error: "Business not found", reason: "api_error" };
  }

  if (phoneResult.error || !phoneResult.data) {
    return { success: false, error: "No active phone number found", reason: "api_error" };
  }

  if (aiConfigResult.error || !aiConfigResult.data?.retell_agent_id) {
    return { success: false, error: "AI agent not configured", reason: "no_agent" };
  }

  const fromNumber = phoneResult.data.number;
  const agentId = aiConfigResult.data.retell_agent_id;
  const business = businessResult.data;

  // Verify phone number is registered with Retell
  const retellPhoneCheck = await verifyRetellPhoneNumber(fromNumber);
  if (!retellPhoneCheck.registered) {
    return {
      success: false,
      error: retellPhoneCheck.error || `Phone number ${fromNumber} not registered with Retell`,
      reason: "api_error"
    };
  }

  // Get transfer number from call settings
  const transferNumber = callSettingsResult.data?.transfer_number || callSettingsResult.data?.backup_transfer_number || "";

  // Prepare dynamic variables
  const dynamicVariables = prepareDynamicVariables({
    businessName: business.name,
    aiName: aiConfigResult.data.ai_name || "Koya",
    transferEnabled: !!transferNumber,
    transferNumber: transferNumber,
    isOutbound: true,
    outboundPurpose: options.purpose,
    customMessage: options.customMessage,
    ...options.dynamicVariables,
  });

  // Create outbound call with Retell
  try {
    const retellResult = await createOutboundCall({
      agentId,
      fromNumber,
      toNumber: normalizedTo,
      dynamicVariables,
      metadata: {
        business_id: businessId,
        direction: "outbound",
        purpose: options.purpose,
        appointment_id: options.appointmentId || "",
        ...options.metadata,
      },
    });

    if (!retellResult) {
      return { success: false, error: "Failed to create call with Retell", reason: "api_error" };
    }

    // Create call record in database
    const { data: callRecord, error: callError } = await supabase
      .from("calls")
      .insert({
        business_id: businessId,
        retell_call_id: retellResult.call_id,
        from_number: fromNumber,
        to_number: normalizedTo,
        started_at: new Date().toISOString(),
        language: "en",
        outcome: null, // Will be updated by webhook
      })
      .select("id")
      .single();

    if (callError) {
      logError("Outbound Call Record", callError);
    }

    // Increment daily counter
    await supabase.rpc("increment_outbound_calls_today", { p_business_id: businessId });

    logInfo("Outbound Call", `Initiated call to ${normalizedTo} for business ${businessId}`);

    return {
      success: true,
      callId: callRecord?.id,
      retellCallId: retellResult.call_id,
    };
  } catch (error) {
    logError("Outbound Call", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to initiate call";
    return { success: false, error: errorMessage, reason: "api_error" };
  }
}

// =============================================================================
// Call Queue Management
// =============================================================================

/**
 * Add a call to the queue for later processing
 */
export async function addToCallQueue(
  businessId: string,
  toNumber: string,
  options: {
    purpose: string;
    appointmentId?: string;
    customMessage?: string;
    metadata?: Record<string, unknown>;
    scheduledFor?: string;
    campaignId?: string;
    contactName?: string;
    priority?: number;
  }
): Promise<{ success: boolean; queueId?: string; error?: string }> {
  const supabase = createAdminClient() as AnySupabaseClient;

  // Normalize phone number
  const normalizedTo = toNumber.startsWith("+") ? toNumber : `+1${toNumber.replace(/\D/g, "")}`;

  // Check DNC list first
  const isDNC = await checkDNC(businessId, normalizedTo, supabase);
  if (isDNC) {
    return { success: false, error: "Number is on Do-Not-Call list" };
  }

  // Build dynamic_variables from metadata and custom message
  const dynamicVariables: Record<string, unknown> = {
    ...options.metadata,
    purpose: options.purpose,
  };
  if (options.customMessage) {
    dynamicVariables.custom_message = options.customMessage;
  }

  const { data, error } = await supabase
    .from("outbound_call_queue")
    .insert({
      business_id: businessId,
      contact_phone: normalizedTo,
      contact_name: options.contactName || null,
      appointment_id: options.appointmentId || null,
      campaign_id: options.campaignId || null,
      dynamic_variables: dynamicVariables,
      scheduled_for: options.scheduledFor || new Date().toISOString(),
      status: "pending",
      attempt_count: 0,
      priority: options.priority || 0,
    })
    .select("id")
    .single();

  if (error) {
    logError("Add to Call Queue", error);
    return { success: false, error: "Failed to add to queue" };
  }

  return { success: true, queueId: data?.id };
}

/**
 * Schedule a reminder call for an appointment
 */
export async function scheduleReminderCall(
  appointmentId: string,
  reminderType: "24hr" | "2hr"
): Promise<{ success: boolean; queueId?: string; error?: string }> {
  const supabase = createAdminClient() as AnySupabaseClient;

  // Get appointment details
  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select(`
      id,
      business_id,
      customer_phone,
      customer_name,
      service_name,
      scheduled_at,
      businesses!inner (
        name,
        timezone
      )
    `)
    .eq("id", appointmentId)
    .single();

  if (appointmentError || !appointment) {
    return { success: false, error: "Appointment not found" };
  }

  if (!appointment.customer_phone) {
    return { success: false, error: "No customer phone number" };
  }

  // Calculate when to make the call
  const appointmentTime = DateTime.fromISO(appointment.scheduled_at as string);
  const callTime = reminderType === "24hr"
    ? appointmentTime.minus({ hours: 24 })
    : appointmentTime.minus({ hours: 2 });

  // Don't schedule if the time has already passed
  if (callTime < DateTime.now()) {
    return { success: false, error: "Reminder time has already passed" };
  }

  const businessData = appointment.businesses as unknown as { name: string } | null;
  const businessName = businessData?.name || "the business";

  return addToCallQueue(appointment.business_id as string, appointment.customer_phone, {
    purpose: "reminder",
    appointmentId,
    customMessage: `This is a reminder call for your appointment at ${businessName}.`,
    contactName: appointment.customer_name || undefined,
    metadata: {
      reminder_type: reminderType,
      service_name: appointment.service_name || "",
      customer_name: appointment.customer_name || "",
    },
    scheduledFor: callTime.toISO() ?? undefined,
  });
}

/**
 * Process the call queue for a business
 */
export async function processCallQueue(
  businessId: string
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const supabase = createAdminClient() as AnySupabaseClient;
  const now = DateTime.now().toISO();

  // Get pending calls that are scheduled for now or earlier
  const { data: queuedCalls, error } = await supabase
    .from("outbound_call_queue")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "pending")
    .lte("scheduled_for", now)
    .order("priority", { ascending: false })
    .order("scheduled_for", { ascending: true })
    .limit(10);

  if (error || !queuedCalls) {
    logError("Process Call Queue", error);
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  // Filter to calls that haven't exceeded max attempts
  const eligibleCalls = queuedCalls.filter(
    (call) => call.attempt_count < (call.max_attempts || 3)
  );

  let succeeded = 0;
  let failed = 0;

  for (const call of eligibleCalls) {
    // Mark as calling
    await supabase
      .from("outbound_call_queue")
      .update({ status: "calling" })
      .eq("id", call.id);

    // Extract purpose from dynamic_variables
    const dynamicVars = (call.dynamic_variables || {}) as Record<string, unknown>;
    const purpose = (dynamicVars.purpose as string) || "custom";
    const customMessage = dynamicVars.custom_message as string | undefined;

    // Attempt the call
    const result = await initiateOutboundCall(call.business_id, call.contact_phone, {
      purpose: purpose as "reminder" | "followup" | "custom",
      customMessage: customMessage,
      appointmentId: call.appointment_id ?? undefined,
      metadata: dynamicVars as Record<string, string>,
    });

    if (result.success) {
      // Mark as completed
      await supabase
        .from("outbound_call_queue")
        .update({
          status: "completed",
          call_id: result.callId,
          retell_call_id: result.retellCallId,
          last_attempt_at: new Date().toISOString(),
          attempt_count: call.attempt_count + 1,
        })
        .eq("id", call.id);
      succeeded++;
    } else {
      // Handle failure
      const newAttempts = call.attempt_count + 1;
      const maxAttempts = call.max_attempts || 3;
      const shouldRetry = newAttempts < maxAttempts && result.reason !== "dnc";

      if (shouldRetry) {
        // Back to pending for retry
        await supabase
          .from("outbound_call_queue")
          .update({
            status: "pending",
            attempt_count: newAttempts,
            last_attempt_at: new Date().toISOString(),
            last_error: result.error || null,
          })
          .eq("id", call.id);
      } else {
        // Mark as failed or dnc_blocked
        const finalStatus = result.reason === "dnc" ? "dnc_blocked" : "failed";
        await supabase
          .from("outbound_call_queue")
          .update({
            status: finalStatus,
            attempt_count: newAttempts,
            last_attempt_at: new Date().toISOString(),
            last_error: result.error || null,
          })
          .eq("id", call.id);
      }
      failed++;
    }
  }

  logInfo("Process Call Queue", `Processed ${eligibleCalls.length} calls: ${succeeded} succeeded, ${failed} failed`);

  return {
    processed: eligibleCalls.length,
    succeeded,
    failed,
  };
}

/**
 * Get queued calls for a business
 */
export async function getQueuedCalls(
  businessId: string,
  options: {
    status?: string;
    campaignId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ calls: QueuedCall[]; total: number }> {
  const supabase = await createClient() as AnySupabaseClient;
  const { status, campaignId, limit = 50, offset = 0 } = options;

  let query = supabase
    .from("outbound_call_queue")
    .select("*", { count: "exact" })
    .eq("business_id", businessId)
    .order("scheduled_for", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }

  if (campaignId) {
    query = query.eq("campaign_id", campaignId);
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    logError("Get Queued Calls", error);
    return { calls: [], total: 0 };
  }

  return {
    calls: (data || []) as QueuedCall[],
    total: count || 0,
  };
}

/**
 * Update a queued call (reschedule or cancel)
 */
export async function updateQueuedCall(
  callId: string,
  businessId: string,
  updates: {
    scheduledFor?: string;
    status?: "pending" | "cancelled";
    customMessage?: string;
    priority?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient() as AnySupabaseClient;

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.scheduledFor) {
    updateData.scheduled_for = updates.scheduledFor;
  }
  if (updates.status) {
    updateData.status = updates.status;
  }
  if (updates.priority !== undefined) {
    updateData.priority = updates.priority;
  }

  // If customMessage is provided, update dynamic_variables
  if (updates.customMessage !== undefined) {
    // First get the current dynamic_variables
    const { data: current } = await supabase
      .from("outbound_call_queue")
      .select("dynamic_variables")
      .eq("id", callId)
      .eq("business_id", businessId)
      .single();

    const currentVars = (current?.dynamic_variables || {}) as Record<string, unknown>;
    updateData.dynamic_variables = {
      ...currentVars,
      custom_message: updates.customMessage,
    };
  }

  const { error } = await supabase
    .from("outbound_call_queue")
    .update(updateData)
    .eq("id", callId)
    .eq("business_id", businessId)
    .in("status", ["pending", "scheduled", "calling"]);

  if (error) {
    logError("Update Queued Call", error);
    return { success: false, error: "Failed to update queued call" };
  }

  return { success: true };
}

// =============================================================================
// Outbound Call Outcome Recording
// =============================================================================

export interface OutboundCallOutcomeParams {
  /** Retell's call ID */
  retellCallId: string;
  /** Business ID */
  businessId: string;
  /** Internal call ID from calls table */
  callId?: string;
  /** Call outcome: completed, failed, no_answer, busy, voicemail, etc. */
  outcome: string;
  /** Call duration in seconds */
  durationSeconds: number;
  /** Disconnection reason from Retell */
  disconnectionReason?: string;
  /** Error message if call failed */
  errorMessage?: string;
}

/**
 * Map Retell disconnection reasons to queue status
 */
function mapDisconnectionToStatus(
  disconnectionReason: string | undefined,
  durationSeconds: number
): "completed" | "failed" | "no_answer" | "declined" {
  if (!disconnectionReason) {
    return durationSeconds > 0 ? "completed" : "failed";
  }

  // Map Retell disconnection reasons to our statuses
  switch (disconnectionReason) {
    case "user_hangup":
    case "agent_hangup":
    case "call_ended":
      return "completed";

    case "no_answer":
    case "user_did_not_answer":
    case "voicemail_reached":
    case "answering_machine":
      return "no_answer";

    case "rejected":
    case "call_rejected":
      return "declined";

    case "busy":
    case "line_busy":
    case "invalid_number":
    case "number_not_reachable":
    case "error":
    case "system_error":
    case "timeout":
      return "failed";

    default:
      // For unknown reasons, decide based on duration
      return durationSeconds > 10 ? "completed" : "failed";
  }
}

/**
 * Map call outcome to a more specific outbound outcome
 */
function mapOutcomeToOutboundOutcome(
  outcome: string,
  disconnectionReason?: string
): string {
  // If we have a specific disconnection reason, use that
  if (disconnectionReason) {
    switch (disconnectionReason) {
      case "no_answer":
      case "user_did_not_answer":
        return "no_answer";
      case "voicemail_reached":
      case "answering_machine":
        return "voicemail";
      case "busy":
      case "line_busy":
        return "busy";
      case "rejected":
      case "call_rejected":
        return "declined";
      case "invalid_number":
        return "invalid_number";
      case "error":
      case "system_error":
        return "error";
      case "user_hangup":
      case "agent_hangup":
        // Normal call ending - use the outcome to determine success
        // Don't treat hanging up as failure, it's how calls end
        break; // Fall through to outcome mapping below
    }
  }

  // Otherwise, map from the call outcome
  switch (outcome) {
    case "booked":
      return "booked";
    case "transferred":
      return "transferred";
    case "message":
      return "message_taken";
    case "info":
      return "completed";
    case "missed":
      return "no_answer";
    default:
      return outcome || "completed";
  }
}

/**
 * Record the outcome of an outbound call
 * Updates the outbound_call_queue record and campaign stats if applicable
 */
export async function recordOutboundCallOutcome(
  params: OutboundCallOutcomeParams
): Promise<{ success: boolean; error?: string }> {
  const {
    retellCallId,
    businessId,
    callId,
    outcome,
    durationSeconds,
    disconnectionReason,
    errorMessage,
  } = params;

  const supabase = createAdminClient() as AnySupabaseClient;

  // Find the queue item by retell_call_id
  const { data: queueItem, error: findError } = await supabase
    .from("outbound_call_queue")
    .select("id, campaign_id, status, attempt_count")
    .eq("retell_call_id", retellCallId)
    .eq("business_id", businessId)
    .single();

  if (findError) {
    // Queue item not found - this might be a direct outbound call not from queue
    // Try to find by call_id if provided
    if (callId) {
      const { data: queueByCallId } = await supabase
        .from("outbound_call_queue")
        .select("id, campaign_id, status, attempt_count")
        .eq("call_id", callId)
        .eq("business_id", businessId)
        .single();

      if (!queueByCallId) {
        // Not a queued call - nothing to update
        logInfo("Outbound Outcome", `No queue item found for call ${retellCallId} - may be a direct outbound call`);
        return { success: true };
      }

      // Use the queue item found by call_id
      return updateQueueItemOutcome(supabase, queueByCallId, {
        outcome,
        durationSeconds,
        disconnectionReason,
        errorMessage,
      });
    }

    // No queue item found at all
    logInfo("Outbound Outcome", `No queue item found for retell call ${retellCallId}`);
    return { success: true };
  }

  return updateQueueItemOutcome(supabase, queueItem, {
    outcome,
    durationSeconds,
    disconnectionReason,
    errorMessage,
  });
}

/**
 * Update a queue item with the call outcome
 */
async function updateQueueItemOutcome(
  supabase: AnySupabaseClient,
  queueItem: {
    id: string;
    campaign_id: string | null;
    status: string;
    attempt_count: number;
  },
  outcomeData: {
    outcome: string;
    durationSeconds: number;
    disconnectionReason?: string;
    errorMessage?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const { outcome, durationSeconds, disconnectionReason, errorMessage } = outcomeData;

  // Log raw data for debugging
  logInfo(
    "Outbound Outcome Raw",
    `Queue ${queueItem.id}: disconnectionReason="${disconnectionReason}", duration=${durationSeconds}s, outcome="${outcome}"`
  );

  // Determine the final status based on the outcome
  const finalStatus = mapDisconnectionToStatus(disconnectionReason, durationSeconds);
  const outboundOutcome = mapOutcomeToOutboundOutcome(outcome, disconnectionReason);

  // Update the queue item
  const updateData: Record<string, unknown> = {
    status: finalStatus,
    outcome: outboundOutcome,
    last_attempt_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Add error message if call failed
  if (finalStatus === "failed" || finalStatus === "no_answer") {
    updateData.last_error = errorMessage || disconnectionReason || null;
  }

  const { error: updateError } = await supabase
    .from("outbound_call_queue")
    .update(updateData)
    .eq("id", queueItem.id);

  if (updateError) {
    logError("Outbound Outcome Update", updateError);
    return { success: false, error: "Failed to update queue item" };
  }

  logInfo(
    "Outbound Outcome",
    `Updated queue item ${queueItem.id}: status=${finalStatus}, outcome=${outboundOutcome}`
  );

  // Update campaign stats if this was part of a campaign
  if (queueItem.campaign_id) {
    await updateCampaignStats(supabase, queueItem.campaign_id, finalStatus, outboundOutcome);
  }

  return { success: true };
}

/**
 * Update campaign statistics after a call completes
 */
async function updateCampaignStats(
  supabase: AnySupabaseClient,
  campaignId: string,
  status: "completed" | "failed" | "no_answer" | "declined",
  outcome: string
): Promise<void> {
  try {
    // Get current campaign data
    const { data: campaign, error: campaignError } = await supabase
      .from("outbound_campaigns")
      .select("id, settings")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      logWarning("Campaign Stats", `Campaign ${campaignId} not found`);
      return;
    }

    // Parse existing stats from settings or initialize
    const settings = (campaign.settings || {}) as Record<string, unknown>;
    const stats = (settings.stats || {
      total_calls: 0,
      completed_calls: 0,
      failed_calls: 0,
      no_answer_calls: 0,
      booked_calls: 0,
      transferred_calls: 0,
    }) as Record<string, number>;

    // Update stats
    stats.total_calls = (stats.total_calls || 0) + 1;

    if (status === "completed") {
      stats.completed_calls = (stats.completed_calls || 0) + 1;
    } else if (status === "failed") {
      stats.failed_calls = (stats.failed_calls || 0) + 1;
    } else if (status === "no_answer") {
      stats.no_answer_calls = (stats.no_answer_calls || 0) + 1;
    }

    // Track specific outcomes
    if (outcome === "booked") {
      stats.booked_calls = (stats.booked_calls || 0) + 1;
    } else if (outcome === "transferred") {
      stats.transferred_calls = (stats.transferred_calls || 0) + 1;
    }

    // Update campaign settings with new stats
    const updatedSettings = {
      ...settings,
      stats,
      last_call_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("outbound_campaigns")
      .update({ settings: updatedSettings })
      .eq("id", campaignId);

    if (updateError) {
      logError("Campaign Stats Update", updateError);
    } else {
      logInfo("Campaign Stats", `Updated stats for campaign ${campaignId}: ${JSON.stringify(stats)}`);
    }

    // Check if campaign is complete (all queue items processed)
    const { count: pendingCount } = await supabase
      .from("outbound_call_queue")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", ["pending", "scheduled", "calling"]);

    if (pendingCount === 0) {
      // All calls processed - mark campaign as completed
      const { error: completeError } = await supabase
        .from("outbound_campaigns")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", campaignId)
        .eq("status", "running"); // Only update if currently running

      if (!completeError) {
        logInfo("Campaign Complete", `Campaign ${campaignId} completed - all calls processed`);
      }
    }
  } catch (error) {
    logError("Campaign Stats", error);
  }
}

// =============================================================================
// Outbound Settings Management
// =============================================================================

/**
 * Get outbound settings for a business
 */
export async function getOutboundSettings(
  businessId: string
): Promise<OutboundSettings | null> {
  const supabase = await createClient() as AnySupabaseClient;

  const { data, error } = await supabase
    .from("outbound_settings")
    .select("*")
    .eq("business_id", businessId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No settings found, return defaults
      return {
        outbound_enabled: false,
        reminder_calls_enabled: false,
        reminder_call_24hr: true,
        reminder_call_2hr: false,
        reminder_call_agent_id: null,
        reminder_call_from_number: null,
        outbound_daily_limit: 100,
        outbound_hours_start: "09:00",
        outbound_hours_end: "18:00",
        outbound_days: [1, 2, 3, 4, 5],
        outbound_timezone: "America/New_York",
        calls_made_today: 0,
        last_reset_date: null,
      };
    }
    logError("Get Outbound Settings", error);
    return null;
  }

  // Map database column names to interface
  return {
    outbound_enabled: data.outbound_enabled ?? false,
    reminder_calls_enabled: data.reminder_calls_enabled ?? false,
    reminder_call_24hr: data.reminder_call_24hr ?? true,
    reminder_call_2hr: data.reminder_call_2hr ?? false,
    reminder_call_agent_id: data.reminder_call_agent_id ?? null,
    reminder_call_from_number: data.reminder_call_from_number ?? null,
    outbound_daily_limit: data.outbound_daily_limit ?? 100,
    outbound_hours_start: typeof data.outbound_hours_start === 'string'
      ? data.outbound_hours_start.substring(0, 5)
      : "09:00",
    outbound_hours_end: typeof data.outbound_hours_end === 'string'
      ? data.outbound_hours_end.substring(0, 5)
      : "18:00",
    outbound_days: data.outbound_days ?? [1, 2, 3, 4, 5],
    outbound_timezone: data.outbound_timezone ?? "America/New_York",
    calls_made_today: data.calls_made_today ?? 0,
    last_reset_date: data.last_reset_date ?? null,
  };
}

/**
 * Update outbound settings for a business
 */
export async function updateOutboundSettings(
  businessId: string,
  updates: Partial<OutboundSettings>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient() as AnySupabaseClient;

  // Check if settings exist
  const { data: existing } = await supabase
    .from("outbound_settings")
    .select("id")
    .eq("business_id", businessId)
    .single();

  // Map interface names to database column names
  const dbUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.outbound_enabled !== undefined) {
    dbUpdates.outbound_enabled = updates.outbound_enabled;
  }
  if (updates.reminder_calls_enabled !== undefined) {
    dbUpdates.reminder_calls_enabled = updates.reminder_calls_enabled;
  }
  if (updates.reminder_call_24hr !== undefined) {
    dbUpdates.reminder_call_24hr = updates.reminder_call_24hr;
  }
  if (updates.reminder_call_2hr !== undefined) {
    dbUpdates.reminder_call_2hr = updates.reminder_call_2hr;
  }
  if (updates.reminder_call_agent_id !== undefined) {
    dbUpdates.reminder_call_agent_id = updates.reminder_call_agent_id;
  }
  if (updates.reminder_call_from_number !== undefined) {
    dbUpdates.reminder_call_from_number = updates.reminder_call_from_number;
  }
  if (updates.outbound_daily_limit !== undefined) {
    dbUpdates.outbound_daily_limit = updates.outbound_daily_limit;
  }
  if (updates.outbound_hours_start !== undefined) {
    dbUpdates.outbound_hours_start = updates.outbound_hours_start;
  }
  if (updates.outbound_hours_end !== undefined) {
    dbUpdates.outbound_hours_end = updates.outbound_hours_end;
  }
  if (updates.outbound_days !== undefined) {
    dbUpdates.outbound_days = updates.outbound_days;
  }
  if (updates.outbound_timezone !== undefined) {
    dbUpdates.outbound_timezone = updates.outbound_timezone;
  }

  if (existing) {
    const { error } = await supabase
      .from("outbound_settings")
      .update(dbUpdates)
      .eq("business_id", businessId);

    if (error) {
      logError("Update Outbound Settings", error);
      return { success: false, error: "Failed to update settings" };
    }
  } else {
    const { error } = await supabase.from("outbound_settings").insert({
      business_id: businessId,
      ...dbUpdates,
    });

    if (error) {
      logError("Create Outbound Settings", error);
      return { success: false, error: "Failed to create settings" };
    }
  }

  return { success: true };
}

// =============================================================================
// Exports
// =============================================================================

export {
  isRetellConfigured,
  getRetellClient,
};
