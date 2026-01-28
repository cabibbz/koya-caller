/**
 * Koya Caller - Calendar Sync Background Jobs
 * Session 21: Background Jobs - Calendar Two-Way Sync
 *
 * Handles syncing external calendar changes back to Koya:
 * - Detect cancelled events in Google/Outlook
 * - Detect moved/rescheduled events
 * - Update Koya appointments accordingly
 */

import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCalendarClient } from "@/lib/calendar";
import type { } from "@/lib/calendar/types";
import { logError, logWarning } from "@/lib/logging";

// =============================================================================
// Types
// =============================================================================

interface AppointmentWithExternalId {
  id: string;
  business_id: string;
  external_event_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  customer_name: string;
  service_name: string;
}

interface CalendarIntegration {
  business_id: string;
  provider: string;
}

// =============================================================================
// Scheduled Calendar Sync Job
// =============================================================================

/**
 * Scheduled job to sync external calendar changes
 * Runs every 15 minutes
 */
export const syncExternalCalendars = inngest.createFunction(
  {
    id: "calendar-sync-external",
    name: "Sync External Calendar Changes",
  },
  { cron: "*/15 * * * *" }, // Every 15 minutes
  async ({ step }) => {
    const supabase = createAdminClient();

    // Step 1: Get all businesses with external calendar integrations
    const integrations = await step.run("fetch-integrations", async () => {
      const { data, error } = await (supabase as any)
        .from("calendar_integrations")
        .select("business_id, provider")
        .neq("provider", "built_in")
        .not("access_token", "is", null);

      if (error) {
        throw new Error(`Failed to fetch integrations: ${error.message}`);
      }

      return (data || []) as CalendarIntegration[];
    });

    if (integrations.length === 0) {
      return { synced: 0, message: "No external calendars connected" };
    }

    // Step 2: Queue sync for each business
    const events = integrations.map((integration) => ({
      name: "calendar/sync.business" as const,
      data: {
        businessId: integration.business_id,
        provider: integration.provider,
      },
    }));

    await step.sendEvent("queue-business-syncs", events);

    return {
      queued: integrations.length,
      businesses: integrations.map((i) => i.business_id),
    };
  }
);

// =============================================================================
// Sync Single Business Calendar
// =============================================================================

/**
 * Sync a single business's calendar with Koya appointments
 * Triggered by the scheduled job or manually
 */
export const syncBusinessCalendar = inngest.createFunction(
  {
    id: "calendar-sync-business",
    name: "Sync Business Calendar",
    retries: 2,
    concurrency: {
      limit: 5, // Max 5 concurrent syncs
    },
  },
  { event: "calendar/sync.business" },
  async ({ event, step }) => {
    const { businessId } = event.data;
    const supabase = createAdminClient();

    // Step 1: Get future appointments with external event IDs
    const appointments = await step.run("fetch-appointments", async () => {
      const now = new Date().toISOString();
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await (supabase as any)
        .from("appointments")
        .select("id, business_id, external_event_id, scheduled_at, duration_minutes, status, customer_name, service_name")
        .eq("business_id", businessId)
        .not("external_event_id", "is", null)
        .neq("status", "cancelled")
        .gte("scheduled_at", now)
        .lte("scheduled_at", thirtyDaysFromNow)
        .order("scheduled_at", { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch appointments: ${error.message}`);
      }

      return (data || []) as AppointmentWithExternalId[];
    });

    if (appointments.length === 0) {
      return { synced: 0, message: "No appointments to sync" };
    }

    // Step 2: Get calendar client and fetch events
    const calendarEvents = await step.run("fetch-calendar-events", async () => {
      const client = await createCalendarClient(businessId);
      if (!client) {
        throw new Error("Calendar client not available");
      }

      // Get time range from appointments
      const timeMin = new Date(appointments[0].scheduled_at);
      const lastApt = appointments[appointments.length - 1];
      const timeMax = new Date(new Date(lastApt.scheduled_at).getTime() + lastApt.duration_minutes * 60000 + 24 * 60 * 60 * 1000);

      try {
        const events = await client.getEvents(timeMin, timeMax);
        // Convert to serializable format
        return events.map((e) => ({
          id: e.id,
          summary: e.summary,
          start: e.start.toISOString(),
          end: e.end.toISOString(),
          status: e.status,
        }));
      } catch (err) {
        logError("Calendar Sync", `Failed to fetch events for business ${businessId}: ${err}`);
        throw err;
      }
    });

    // Build a map of external event ID -> event for quick lookup
    const eventMap = new Map<string, { id: string; summary: string; start: string; end: string; status: string }>();
    for (const event of calendarEvents) {
      eventMap.set(event.id, event);
    }

    // Step 3: Compare and update appointments
    const syncResults = await step.run("sync-appointments", async () => {
      const results = {
        cancelled: [] as string[],
        rescheduled: [] as string[],
        unchanged: 0,
        errors: [] as string[],
      };

      for (const apt of appointments) {
        const calendarEvent = eventMap.get(apt.external_event_id);

        try {
          if (!calendarEvent) {
            // Event not found in calendar - might be cancelled
            // Only mark as cancelled if the appointment is still in the future
            const aptTime = new Date(apt.scheduled_at);
            if (aptTime > new Date()) {
              await (supabase as any)
                .from("appointments")
                .update({
                  status: "cancelled",
                  notes: `Auto-cancelled: Calendar event was deleted`,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", apt.id);

              results.cancelled.push(apt.id);
              logWarning("Calendar Sync", `Appointment ${apt.id} cancelled - external event ${apt.external_event_id} not found`);
            }
          } else if (calendarEvent.status === "cancelled") {
            // Event explicitly cancelled in calendar
            await (supabase as any)
              .from("appointments")
              .update({
                status: "cancelled",
                notes: `Auto-cancelled: Calendar event was cancelled`,
                updated_at: new Date().toISOString(),
              })
              .eq("id", apt.id);

            results.cancelled.push(apt.id);
          } else {
            // Check if time changed
            const calendarStart = new Date(calendarEvent.start);
            const aptStart = new Date(apt.scheduled_at);

            // Allow 1 minute tolerance for time comparison
            const timeDiffMs = Math.abs(calendarStart.getTime() - aptStart.getTime());
            if (timeDiffMs > 60000) {
              // Event was rescheduled - update appointment
              const calendarEnd = new Date(calendarEvent.end);
              const newDuration = Math.round((calendarEnd.getTime() - calendarStart.getTime()) / 60000);

              await (supabase as any)
                .from("appointments")
                .update({
                  scheduled_at: calendarStart.toISOString(),
                  duration_minutes: newDuration > 0 ? newDuration : apt.duration_minutes,
                  notes: apt.service_name.includes("Rescheduled")
                    ? undefined
                    : `Rescheduled from calendar. Original: ${aptStart.toISOString()}`,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", apt.id);

              results.rescheduled.push(apt.id);
              logWarning("Calendar Sync", `Appointment ${apt.id} rescheduled from ${aptStart.toISOString()} to ${calendarStart.toISOString()}`);
            } else {
              results.unchanged++;
            }
          }
        } catch (err) {
          results.errors.push(`${apt.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
      }

      return results;
    });

    return {
      businessId,
      total: appointments.length,
      ...syncResults,
    };
  }
);

// =============================================================================
// Manual Sync Trigger
// =============================================================================

/**
 * Trigger a manual sync for a specific business
 * Can be called from the dashboard
 */
export async function triggerCalendarSync(businessId: string): Promise<void> {
  await inngest.send({
    name: "calendar/sync.business",
    data: { businessId },
  });
}
