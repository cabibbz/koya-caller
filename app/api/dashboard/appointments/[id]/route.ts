/**
 * Appointment Detail API Route
 * Session 17: Dashboard - Appointments & Knowledge
 * Spec Reference: Part 7, Lines 716 (Actions: Cancel, Reschedule, Mark complete)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Rate limit check
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitResult = await checkRateLimit("dashboard", ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    // Verify auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Get appointment
    const { data: appointment, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", id)
      .eq("business_id", (business as { id: string }).id)
      .single();

    if (error || !appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    return NextResponse.json({ appointment });
  } catch (_error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Rate limit check
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitResult = await checkRateLimit("dashboard", ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    // Verify auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const body = await request.json();
    const { action, ...updates } = body;

    // If there's an action, validate the state transition
    if (action) {
      // First, get current appointment status
      const { data: currentAppointment, error: fetchError } = await supabase
        .from("appointments")
        .select("status")
        .eq("id", id)
        .eq("business_id", (business as { id: string }).id)
        .single();

      if (fetchError || !currentAppointment) {
        return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
      }

      const currentStatus = (currentAppointment as { status: string }).status;
      
      // Validate state transitions
      const invalidTransitions: Record<string, string[]> = {
        cancelled: ["complete", "no_show", "cancel"], // Can't change cancelled appointments
        completed: ["complete", "cancel"], // Can only mark no_show on completed
        no_show: ["no_show", "complete"], // Can only cancel no_shows
      };

      if (invalidTransitions[currentStatus]?.includes(action)) {
        return NextResponse.json({ 
          error: `Cannot ${action} an appointment that is already ${currentStatus}` 
        }, { status: 400 });
      }
    }

    // Handle actions - Spec Line 716
    let statusUpdate: Record<string, unknown> = {};

    if (action === "cancel") {
      statusUpdate = { status: "cancelled" };
    } else if (action === "complete") {
      statusUpdate = { status: "completed" };
    } else if (action === "no_show") {
      statusUpdate = { status: "no_show" };
    } else if (action === "reschedule") {
      // Reschedule action - requires new scheduled_at and optionally duration_minutes
      const { scheduled_at, duration_minutes } = updates;

      if (!scheduled_at) {
        return NextResponse.json(
          { error: "New scheduled time is required for rescheduling" },
          { status: 400 }
        );
      }

      // Get current appointment to validate status and get duration
      const { data: currentAppointment, error: fetchError } = await supabase
        .from("appointments")
        .select("status, duration_minutes, scheduled_at")
        .eq("id", id)
        .eq("business_id", (business as { id: string }).id)
        .single();

      if (fetchError || !currentAppointment) {
        return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
      }

      const appt = currentAppointment as { status: string; duration_minutes: number | null; scheduled_at: string };

      // Only confirmed appointments can be rescheduled
      if (appt.status !== "confirmed") {
        return NextResponse.json(
          { error: `Cannot reschedule an appointment that is ${appt.status}` },
          { status: 400 }
        );
      }

      // Use new duration or keep existing
      const newDuration = duration_minutes || appt.duration_minutes || 60;
      const scheduledStart = new Date(scheduled_at);
      const scheduledEnd = new Date(scheduledStart.getTime() + (newDuration * 60 * 1000));

      // Check for conflicts with other confirmed appointments (excluding this one)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      const { data: existingAppointments, error: checkError } = await (supabase as any)
        .from("appointments")
        .select("id, scheduled_at, duration_minutes, customer_name")
        .eq("business_id", (business as { id: string }).id)
        .eq("status", "confirmed")
        .neq("id", id) // Exclude current appointment
        .gte("scheduled_at", new Date(scheduledStart.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .lte("scheduled_at", new Date(scheduledStart.getTime() + 24 * 60 * 60 * 1000).toISOString());

      if (!checkError && existingAppointments) {
        for (const existing of existingAppointments) {
          const existingStart = new Date(existing.scheduled_at);
          const existingEnd = new Date(existingStart.getTime() + ((existing.duration_minutes || 60) * 60 * 1000));

          // Check if new time overlaps with existing appointment
          if (scheduledStart < existingEnd && scheduledEnd > existingStart) {
            return NextResponse.json(
              {
                error: "Time slot conflict",
                message: `This time overlaps with an existing appointment for ${existing.customer_name || "another customer"}`
              },
              { status: 409 }
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
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    // Update appointment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: appointment, error } = await (supabase as any)
      .from("appointments")
      .update(finalUpdates)
      .eq("id", id)
      .eq("business_id", (business as { id: string }).id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update appointment" }, { status: 500 });
    }

    return NextResponse.json({ appointment });
  } catch (_error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Rate limit check
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitResult = await checkRateLimit("dashboard", ip);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    const supabase = await createClient();

    // Verify auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get business
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Delete appointment
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", id)
      .eq("business_id", (business as { id: string }).id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete appointment" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
