/**
 * Appointment Detail API Route
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Lines 716 (Actions: Cancel, Reschedule, Mark complete)
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { deleteCalendarEvent } from "@/lib/calendar";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function handleGet(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext,
  context?: RouteContext
) {
  try {
    if (!context) {
      return errors.badRequest("Invalid request");
    }
    const { id } = await context.params;

    // Get appointment
    const { data: appointment, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", id)
      .eq("business_id", business.id)
      .single();

    if (error || !appointment) {
      return errors.notFound("Appointment");
    }

    return success({ appointment });
  } catch (error) {
    logError("Appointment Detail GET", error);
    return errors.internalError("Failed to fetch appointment");
  }
}

async function handlePatch(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext,
  context?: RouteContext
) {
  try {
    if (!context) {
      return errors.badRequest("Invalid request");
    }
    const { id } = await context.params;

    const body = await request.json();
    const { action, ...updates } = body;

    // If there's an action, validate the state transition
    if (action) {
      // First, get current appointment status
      const { data: currentAppointment, error: fetchError } = await supabase
        .from("appointments")
        .select("status")
        .eq("id", id)
        .eq("business_id", business.id)
        .single();

      if (fetchError || !currentAppointment) {
        return errors.notFound("Appointment");
      }

      const currentStatus = (currentAppointment as { status: string }).status;

      // Validate state transitions
      const invalidTransitions: Record<string, string[]> = {
        cancelled: ["complete", "no_show", "cancel"], // Can't change cancelled appointments
        completed: ["complete", "cancel"], // Can only mark no_show on completed
        no_show: ["no_show", "complete"], // Can only cancel no_shows
      };

      if (invalidTransitions[currentStatus]?.includes(action)) {
        return errors.badRequest(
          `Cannot ${action} an appointment that is already ${currentStatus}`
        );
      }
    }

    // Handle actions - Spec Line 716
    let statusUpdate: Record<string, unknown> = {};

    if (action === "cancel") {
      statusUpdate = { status: "cancelled" };

      // Also delete the calendar event if it exists
      const { data: aptWithEvent } = await supabase
        .from("appointments")
        .select("external_event_id")
        .eq("id", id)
        .single();

      const aptEvent = aptWithEvent as { external_event_id: string | null } | null;
      if (aptEvent?.external_event_id) {
        // Fire-and-forget: Don't block the cancellation if calendar delete fails
        deleteCalendarEvent(business.id, aptEvent.external_event_id).catch(
          () => {
            /* Calendar event deletion failed - appointment still cancelled */
          }
        );
      }
    } else if (action === "complete") {
      statusUpdate = { status: "completed" };
    } else if (action === "no_show") {
      statusUpdate = { status: "no_show" };
    } else if (action === "reschedule") {
      // Reschedule action - requires new scheduled_at and optionally duration_minutes
      const { scheduled_at, duration_minutes } = updates;

      if (!scheduled_at) {
        return errors.badRequest("New scheduled time is required for rescheduling");
      }

      // Get current appointment to validate status and get duration
      const { data: currentAppointment, error: fetchError } = await supabase
        .from("appointments")
        .select("status, duration_minutes, scheduled_at")
        .eq("id", id)
        .eq("business_id", business.id)
        .single();

      if (fetchError || !currentAppointment) {
        return errors.notFound("Appointment");
      }

      const appt = currentAppointment as {
        status: string;
        duration_minutes: number | null;
        scheduled_at: string;
      };

      // Only confirmed appointments can be rescheduled
      if (appt.status !== "confirmed") {
        return errors.badRequest(
          `Cannot reschedule an appointment that is ${appt.status}`
        );
      }

      // Use new duration or keep existing
      const newDuration = duration_minutes || appt.duration_minutes || 60;
      const scheduledStart = new Date(scheduled_at);
      const scheduledEnd = new Date(
        scheduledStart.getTime() + newDuration * 60 * 1000
      );

      // Check for conflicts with other confirmed appointments (excluding this one)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      const { data: existingAppointments, error: checkError } = await (supabase as any)
        .from("appointments")
        .select("id, scheduled_at, duration_minutes, customer_name")
        .eq("business_id", business.id)
        .eq("status", "confirmed")
        .neq("id", id) // Exclude current appointment
        .gte(
          "scheduled_at",
          new Date(scheduledStart.getTime() - 24 * 60 * 60 * 1000).toISOString()
        )
        .lte(
          "scheduled_at",
          new Date(scheduledStart.getTime() + 24 * 60 * 60 * 1000).toISOString()
        );

      if (!checkError && existingAppointments) {
        for (const existing of existingAppointments) {
          const existingStart = new Date(existing.scheduled_at);
          const existingEnd = new Date(
            existingStart.getTime() + (existing.duration_minutes || 60) * 60 * 1000
          );

          // Check if new time overlaps with existing appointment
          if (scheduledStart < existingEnd && scheduledEnd > existingStart) {
            return errors.conflict(
              `This time overlaps with an existing appointment for ${existing.customer_name || "another customer"}`
            );
          }
        }
      }

      // Set reschedule updates - reset reminder flags so new reminders can be sent
      statusUpdate = {
        scheduled_at: scheduled_at,
        duration_minutes: newDuration,
        reminder_sent_at: null,
        reminder_1hr_sent_at: null,
        reminder_24hr_sent_at: null,
      };

      // Remove scheduled_at and duration_minutes from updates to avoid duplication
      delete updates.scheduled_at;
      delete updates.duration_minutes;
    }

    // Merge action status with any other updates
    const finalUpdates = { ...updates, ...statusUpdate };

    if (Object.keys(finalUpdates).length === 0) {
      return errors.badRequest("No updates provided");
    }

    // Update appointment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: appointment, error } = await (supabase as any)
      .from("appointments")
      .update(finalUpdates)
      .eq("id", id)
      .eq("business_id", business.id)
      .select()
      .single();

    if (error) {
      return errors.internalError("Failed to update appointment");
    }

    return success({ appointment });
  } catch (error) {
    logError("Appointment Detail PATCH", error);
    return errors.internalError("Failed to update appointment");
  }
}

async function handleDelete(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext,
  context?: RouteContext
) {
  try {
    if (!context) {
      return errors.badRequest("Invalid request");
    }
    const { id } = await context.params;

    // Delete appointment
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", id)
      .eq("business_id", business.id);

    if (error) {
      return errors.internalError("Failed to delete appointment");
    }

    return success({ deleted: true });
  } catch (error) {
    logError("Appointment Detail DELETE", error);
    return errors.internalError("Failed to delete appointment");
  }
}

// Apply auth middleware - cast needed for route context support
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET = withAuth(handleGet as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PATCH = withAuth(handlePatch as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DELETE = withAuth(handleDelete as any);
