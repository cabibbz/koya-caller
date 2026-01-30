/**
 * Public Booking API
 * GET /api/public/book?slug=xxx - Get business info, services, and availability for public booking page
 * POST /api/public/book - Submit a booking request (no auth required)
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNylasAvailability } from "@/lib/nylas/availability";
import { createCalendarClient, createAppointmentEvent } from "@/lib/calendar";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

/**
 * GET: Fetch public business info + available time slots
 */
export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  const date = request.nextUrl.searchParams.get("date"); // YYYY-MM-DD
  const serviceId = request.nextUrl.searchParams.get("serviceId");

  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Fetch business by slug (public info only)
  const { data: business, error: bizError } = await (supabase as any)
    .from("businesses")
    .select("id, name, timezone, slug")
    .eq("slug", slug)
    .single();

  if (bizError || !business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Fetch active services
  const { data: services } = await (supabase as any)
    .from("services")
    .select("id, name, duration_minutes, price, description")
    .eq("business_id", business.id)
    .eq("is_active", true)
    .order("name");

  // If a date is provided, fetch available time slots
  let timeSlots: Array<{ startTime: number; endTime: number }> = [];
  if (date) {
    const tz = business.timezone || "America/New_York";
    const serviceDuration = serviceId
      ? services?.find((s: any) => s.id === serviceId)?.duration_minutes || 60
      : 60;

    // Build start/end of the requested date in business timezone
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(`${date}T23:59:59`);
    const startTime = Math.floor(dayStart.getTime() / 1000);
    const endTime = Math.floor(dayEnd.getTime() / 1000);

    try {
      const result = await getNylasAvailability(business.id, {
        startTime,
        endTime,
        durationMinutes: serviceDuration,
        intervalMinutes: 30,
        bufferMinutes: 15,
      });
      timeSlots = result.timeSlots.map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
      }));
    } catch (err) {
      logError("Public Booking Availability", err);
    }
  }

  // Fetch business hours for display
  const { data: hours } = await (supabase as any)
    .from("business_hours")
    .select("day_of_week, is_closed, open_time, close_time")
    .eq("business_id", business.id)
    .order("day_of_week");

  return NextResponse.json({
    business: {
      name: business.name,
      slug: business.slug,
      timezone: business.timezone,
    },
    services: services || [],
    hours: hours || [],
    timeSlots,
  });
}

/**
 * POST: Submit a public booking
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, serviceId, startTime, customerName, customerPhone, customerEmail, notes } = body;

    if (!slug || !serviceId || !startTime || !customerName || !customerPhone) {
      return NextResponse.json(
        { error: "Missing required fields: slug, serviceId, startTime, customerName, customerPhone" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Look up business
    const { data: business } = await (supabase as any)
      .from("businesses")
      .select("id, name, timezone, phone")
      .eq("slug", slug)
      .single();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Look up service
    const { data: service } = await (supabase as any)
      .from("services")
      .select("id, name, duration_minutes, price")
      .eq("id", serviceId)
      .eq("business_id", business.id)
      .single();

    if (!service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const start = new Date(startTime * 1000);
    const end = new Date((startTime + service.duration_minutes * 60) * 1000);

    // Check for double-booking
    const { data: conflicts } = await (supabase as any)
      .from("appointments")
      .select("id")
      .eq("business_id", business.id)
      .in("status", ["confirmed", "pending"])
      .lt("start_time", end.toISOString())
      .gt("end_time", start.toISOString())
      .limit(1);

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json(
        { error: "This time slot is no longer available" },
        { status: 409 }
      );
    }

    // Find or create contact
    let contactId: string | null = null;
    const { data: existingContact } = await (supabase as any)
      .from("contacts")
      .select("id")
      .eq("business_id", business.id)
      .eq("phone", customerPhone)
      .single();

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const { data: newContact } = await (supabase as any)
        .from("contacts")
        .insert({
          business_id: business.id,
          name: customerName,
          phone: customerPhone,
          email: customerEmail || null,
          source: "online_booking",
        })
        .select("id")
        .single();
      contactId = newContact?.id || null;
    }

    // Create appointment
    const { data: appointment, error: aptError } = await (supabase as any)
      .from("appointments")
      .insert({
        business_id: business.id,
        contact_id: contactId,
        service_id: service.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: "confirmed",
        notes: notes || null,
        source: "online_booking",
      })
      .select("id")
      .single();

    if (aptError) {
      logError("Public Booking Create", aptError);
      return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
    }

    // Sync to external calendar
    try {
      const eventId = await createAppointmentEvent(business.id, {
        summary: `${service.name} - ${customerName}`,
        description: `Booked online\nPhone: ${customerPhone}${customerEmail ? `\nEmail: ${customerEmail}` : ""}${notes ? `\nNotes: ${notes}` : ""}`,
        start,
        end,
        customerEmail: customerEmail || undefined,
        customerName,
      });

      if (eventId) {
        await (supabase as any)
          .from("appointments")
          .update({ external_event_id: eventId })
          .eq("id", appointment.id);
      }
    } catch {
      // Calendar sync failure shouldn't block booking
    }

    // Send confirmation email (non-blocking)
    if (customerEmail) {
      sendBookingConfirmationEmail({
        to: customerEmail,
        businessName: business.name,
        customerName,
        serviceName: service.name,
        appointmentDate: start.toLocaleDateString(),
        appointmentTime: start.toLocaleTimeString(),
        businessPhone: business.phone || "",
        businessId: business.id,
      }).catch((err) => logError("Public Booking Email", err));
    }

    return NextResponse.json({
      success: true,
      appointmentId: appointment.id,
      appointment: {
        serviceName: service.name,
        start: start.toISOString(),
        end: end.toISOString(),
        customerName,
      },
    });
  } catch (err) {
    logError("Public Booking", err);
    return NextResponse.json({ error: "Failed to process booking" }, { status: 500 });
  }
}
