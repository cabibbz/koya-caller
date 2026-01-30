/**
 * Koya Caller - Outbound Calls Background Jobs
 * Background jobs for processing outbound call queue and reminders
 *
 * Features:
 * - Process call queue every 5 minutes
 * - Handle reminder calls (24hr and 2hr before appointments)
 * - Retry failed calls with exponential backoff
 * - Respect business hours and daily limits
 */

import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  processCallQueue,
  scheduleReminderCall,
  isWithinOutboundHours,
  checkDailyLimit,
} from "@/lib/outbound";
import { DateTime } from "luxon";
import { logError, logInfo, logWarning } from "@/lib/logging";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

// =============================================================================
// Process Call Queue (Scheduled Job)
// =============================================================================

/**
 * Scheduled job to process pending outbound calls
 * Runs every 5 minutes to check for calls ready to be made
 */
export const processOutboundCallQueue = inngest.createFunction(
  {
    id: "outbound-process-queue",
    name: "Process Outbound Call Queue",
  },
  { cron: "*/5 * * * *" }, // Every 5 minutes
  async ({ step }) => {
    const supabase = createAdminClient() as AnySupabaseClient;

    // Get all businesses with outbound enabled and pending calls
    const businesses = await step.run("fetch-businesses-with-pending-calls", async () => {
      const { data, error } = await supabase
        .from("outbound_settings")
        .select(`
          business_id,
          outbound_enabled,
          businesses!inner (
            id,
            timezone
          )
        `)
        .eq("outbound_enabled", true);

      if (error) {
        logError("Process Queue", error);
        return [];
      }

      return data || [];
    });

    let totalProcessed = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;

    // Process each business's queue
    for (const business of businesses) {
      if (!business) continue;
      const businessId = business.business_id;

      // Check if within outbound hours
      const withinHours = await step.run(
        `check-hours-${businessId}`,
        async () => isWithinOutboundHours(businessId)
      );

      if (!withinHours) {
        continue;
      }

      // Check daily limit
      const limitCheck = await step.run(
        `check-limit-${businessId}`,
        async () => checkDailyLimit(businessId)
      );

      if (!limitCheck.allowed) {
        logWarning(
          "Process Queue",
          `Business ${businessId} has reached daily limit (${limitCheck.used}/${limitCheck.limit})`
        );
        continue;
      }

      // Process the queue
      const result = await step.run(`process-queue-${businessId}`, async () =>
        processCallQueue(businessId)
      );

      totalProcessed += result.processed;
      totalSucceeded += result.succeeded;
      totalFailed += result.failed;
    }

    return {
      businessesChecked: businesses.length,
      totalProcessed,
      totalSucceeded,
      totalFailed,
    };
  }
);

// =============================================================================
// Schedule Reminder Calls (Scheduled Job)
// =============================================================================

/**
 * Scheduled job to check for appointments needing reminder calls
 * Runs every 15 minutes to schedule calls for upcoming appointments
 */
export const checkAppointmentReminderCalls = inngest.createFunction(
  {
    id: "outbound-check-reminders",
    name: "Check Appointment Reminder Calls",
  },
  { cron: "*/15 * * * *" }, // Every 15 minutes
  async ({ step }) => {
    const supabase = createAdminClient() as AnySupabaseClient;
    const now = DateTime.now();

    // Find appointments needing 24hr reminder calls
    const appointments24hr = await step.run("fetch-24hr-reminder-appointments", async () => {
      const windowStart = now.plus({ hours: 23 }).toISO();
      const windowEnd = now.plus({ hours: 25 }).toISO();

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          business_id,
          customer_phone,
          scheduled_at,
          outbound_settings!inner (
            reminder_call_24hr,
            outbound_enabled
          )
        `)
        .eq("status", "confirmed")
        .gte("scheduled_at", windowStart)
        .lte("scheduled_at", windowEnd)
        .is("reminder_call_24hr_queued_at", null)
        .not("customer_phone", "is", null);

      if (error) {
        logError("Check 24hr Reminders", error);
        return [];
      }

      // Filter to only businesses with 24hr call reminders enabled
      return (data || []).filter(
        (apt) => {
          const settings = apt.outbound_settings as unknown as {
            reminder_call_24hr?: boolean;
            outbound_enabled?: boolean;
          } | null;
          return settings?.reminder_call_24hr && settings?.outbound_enabled;
        }
      );
    });

    // Find appointments needing 2hr reminder calls
    const appointments2hr = await step.run("fetch-2hr-reminder-appointments", async () => {
      const windowStart = now.plus({ hours: 1, minutes: 45 }).toISO();
      const windowEnd = now.plus({ hours: 2, minutes: 15 }).toISO();

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          business_id,
          customer_phone,
          scheduled_at,
          outbound_settings!inner (
            reminder_call_2hr,
            outbound_enabled
          )
        `)
        .eq("status", "confirmed")
        .gte("scheduled_at", windowStart)
        .lte("scheduled_at", windowEnd)
        .is("reminder_call_2hr_queued_at", null)
        .not("customer_phone", "is", null);

      if (error) {
        logError("Check 2hr Reminders", error);
        return [];
      }

      // Filter to only businesses with 2hr call reminders enabled
      return (data || []).filter(
        (apt) => {
          const settings = apt.outbound_settings as unknown as {
            reminder_call_2hr?: boolean;
            outbound_enabled?: boolean;
          } | null;
          return settings?.reminder_call_2hr && settings?.outbound_enabled;
        }
      );
    });

    let scheduled24hr = 0;
    let scheduled2hr = 0;

    // Schedule 24hr reminder calls
    for (const apt of appointments24hr) {
      if (!apt) continue;
      const aptId = apt.id;
      const result = await step.run(`schedule-24hr-${aptId}`, async () => {
        const scheduleResult = await scheduleReminderCall(aptId, "24hr");

        if (scheduleResult.success) {
          // Mark as queued
          await supabase
            .from("appointments")
            .update({ reminder_call_24hr_queued_at: new Date().toISOString() })
            .eq("id", aptId);
        }

        return scheduleResult;
      });

      if (result.success) {
        scheduled24hr++;
      }
    }

    // Schedule 2hr reminder calls
    for (const apt of appointments2hr) {
      if (!apt) continue;
      const aptId = apt.id;
      const result = await step.run(`schedule-2hr-${aptId}`, async () => {
        const scheduleResult = await scheduleReminderCall(aptId, "2hr");

        if (scheduleResult.success) {
          // Mark as queued
          await supabase
            .from("appointments")
            .update({ reminder_call_2hr_queued_at: new Date().toISOString() })
            .eq("id", aptId);
        }

        return scheduleResult;
      });

      if (result.success) {
        scheduled2hr++;
      }
    }

    logInfo(
      "Reminder Calls",
      `Scheduled ${scheduled24hr} 24hr and ${scheduled2hr} 2hr reminder calls`
    );

    return {
      checked: {
        "24hr": appointments24hr.length,
        "2hr": appointments2hr.length,
      },
      scheduled: {
        "24hr": scheduled24hr,
        "2hr": scheduled2hr,
      },
    };
  }
);

// =============================================================================
// Retry Failed Calls (Event-Driven)
// =============================================================================

/**
 * Event handler for retrying failed outbound calls
 * Triggered when a call fails and should be retried
 */
export const retryOutboundCall = inngest.createFunction(
  {
    id: "outbound-retry-call",
    name: "Retry Outbound Call",
    retries: 0, // Handle retries manually with exponential backoff
  },
  { event: "outbound/call.retry" },
  async ({ event, step }) => {
    const { queueId, businessId, attempt } = event.data;
    const supabase = createAdminClient() as AnySupabaseClient;

    // Check if within outbound hours
    const withinHours = await step.run("check-hours", async () =>
      isWithinOutboundHours(businessId)
    );

    if (!withinHours) {
      // Reschedule for next available window
      const nextRetry = await step.run("calculate-next-retry", async () => {
        // Get business timezone
        const { data: business } = await supabase
          .from("businesses")
          .select("timezone")
          .eq("id", businessId)
          .single();

        const timezone = business?.timezone || "America/New_York";

        // Get outbound settings
        const { data: settings } = await supabase
          .from("outbound_settings")
          .select("outbound_hours_start, outbound_days")
          .eq("business_id", businessId)
          .single();

        const hoursStart = settings?.outbound_hours_start || "09:00";
        const hoursStartStr = typeof hoursStart === 'string' ? hoursStart.substring(0, 5) : "09:00";
        const allowedDays = settings?.outbound_days || [1, 2, 3, 4, 5];

        // Find next available time
        let nextTime = DateTime.now().setZone(timezone);
        nextTime = nextTime.plus({ days: 1 }).set({
          hour: parseInt(hoursStartStr.split(":")[0], 10),
          minute: parseInt(hoursStartStr.split(":")[1], 10),
          second: 0,
          millisecond: 0,
        });

        // Find next allowed day
        while (!allowedDays.includes(nextTime.weekday % 7)) {
          nextTime = nextTime.plus({ days: 1 });
        }

        return nextTime.toISO();
      });

      // Update queue item - schedule for next window
      await supabase
        .from("outbound_call_queue")
        .update({
          scheduled_for: nextRetry,
          status: "pending",
        })
        .eq("id", queueId);

      return { rescheduled: true, nextRetry };
    }

    // Process this specific call
    const result = await step.run("process-call", async () => {
      // Get the queued call
      const { data: queuedCall } = await supabase
        .from("outbound_call_queue")
        .select("*")
        .eq("id", queueId)
        .single();

      if (!queuedCall || queuedCall.status !== "pending") {
        return { success: false, error: "Call not found or not pending" };
      }

      // Import and call initiateOutboundCall
      const { initiateOutboundCall } = await import("@/lib/outbound");

      // Extract purpose from dynamic_variables
      const dynamicVars = (queuedCall.dynamic_variables || {}) as Record<string, unknown>;
      const purpose = (dynamicVars.purpose as string) || "custom";
      const customMessage = dynamicVars.custom_message as string | undefined;

      return initiateOutboundCall(businessId, queuedCall.contact_phone, {
        purpose: purpose as "reminder" | "followup" | "custom",
        customMessage: customMessage,
        appointmentId: queuedCall.appointment_id ?? undefined,
        metadata: dynamicVars as Record<string, string>,
      });
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
          attempt_count: attempt + 1,
        })
        .eq("id", queueId);

      return { success: true, callId: result.callId };
    }

    // Handle failure with exponential backoff
    const maxAttempts = 3;
    const nextAttempt = attempt + 1;

    if (nextAttempt < maxAttempts && result.reason !== "dnc") {
      const backoffMinutes = Math.pow(2, nextAttempt) * 5; // 10, 20, 40 minutes

      await supabase
        .from("outbound_call_queue")
        .update({
          status: "pending",
          attempt_count: nextAttempt,
          last_attempt_at: new Date().toISOString(),
          last_error: result.error || null,
        })
        .eq("id", queueId);

      // Schedule retry event
      await step.sendEvent("schedule-retry", {
        name: "outbound/call.retry",
        data: { queueId, businessId, attempt: nextAttempt },
        ts: DateTime.now().plus({ minutes: backoffMinutes }).toMillis(),
      });

      const nextRetryTime = DateTime.now().plus({ minutes: backoffMinutes }).toISO();
      return { retryScheduled: true, nextRetry: nextRetryTime, attempt: nextAttempt };
    }

    // Mark as permanently failed
    const finalStatus = result.reason === "dnc" ? "dnc_blocked" : "failed";
    await supabase
      .from("outbound_call_queue")
      .update({
        status: finalStatus,
        attempt_count: nextAttempt,
        last_attempt_at: new Date().toISOString(),
        last_error: result.error || null,
      })
      .eq("id", queueId);

    return { success: false, error: result.error, permanentFailure: true };
  }
);

// =============================================================================
// Reset Daily Counters (Scheduled Job)
// =============================================================================

/**
 * Scheduled job to reset daily outbound call counters
 * Runs at midnight to reset counters for all businesses
 */
export const resetOutboundDailyCounters = inngest.createFunction(
  {
    id: "outbound-reset-daily-counters",
    name: "Reset Outbound Daily Counters",
  },
  { cron: "0 0 * * *" }, // Midnight every day
  async ({ step }) => {
    const supabase = createAdminClient() as AnySupabaseClient;

    const result = await step.run("reset-counters", async () => {
      // Fetch all businesses with their timezone to reset based on local midnight
      const { data: allSettings } = await supabase
        .from("outbound_settings")
        .select("business_id, outbound_timezone, last_reset_date");

      if (!allSettings || allSettings.length === 0) {
        return { success: true, count: 0 };
      }

      let resetCount = 0;
      for (const s of allSettings) {
        const tz = s.outbound_timezone || "America/New_York";
        const todayInTz = DateTime.now().setZone(tz).toISODate();
        if (s.last_reset_date !== todayInTz) {
          const { error } = await supabase
            .from("outbound_settings")
            .update({ calls_made_today: 0, last_reset_date: todayInTz })
            .eq("business_id", s.business_id);
          if (!error) resetCount++;
        }
      }

      return { success: true, count: resetCount };
    });

    logInfo("Outbound Counters", `Reset daily counters for ${"count" in result ? result.count : 0} businesses`);

    return result;
  }
);

// =============================================================================
// Clean Up Old Queue Items (Scheduled Job)
// =============================================================================

/**
 * Scheduled job to clean up old completed/failed queue items
 * Runs weekly to remove items older than 30 days
 */
export const cleanupOutboundQueue = inngest.createFunction(
  {
    id: "outbound-cleanup-queue",
    name: "Cleanup Outbound Queue",
  },
  { cron: "0 2 * * 0" }, // 2 AM every Sunday
  async ({ step }) => {
    const supabase = createAdminClient() as AnySupabaseClient;

    const result = await step.run("cleanup-old-items", async () => {
      const cutoffDate = DateTime.now().minus({ days: 30 }).toISO();

      const { error, count } = await supabase
        .from("outbound_call_queue")
        .delete()
        .in("status", ["completed", "failed", "cancelled", "dnc_blocked"])
        .lt("updated_at", cutoffDate);

      if (error) {
        logError("Cleanup Queue", error);
        return { success: false, error: error.message };
      }

      return { success: true, deleted: count ?? 0 };
    });

    logInfo("Queue Cleanup", `Deleted ${"deleted" in result ? result.deleted : 0} old queue items`);

    return result;
  }
);
