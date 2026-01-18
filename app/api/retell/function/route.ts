/**
 * Koya Caller - Retell Function Call Handler
 * Session 13: Retell.ai Integration
 * Spec Reference: Part 11, Lines 1396-1450
 *
 * Handles function calls from the Retell AI agent during live calls.
 * Functions: check_availability, book_appointment, transfer_call, take_message, send_sms, end_call
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendSMS } from "@/lib/twilio";
import {
  getFullErrorResponse,
  type Personality,
  type ErrorType,
} from "@/lib/claude/error-templates";
import { createCalendarClient, createAppointmentEvent } from "@/lib/calendar";
import { DateTime } from "luxon";
import { logError, logWarning } from "@/lib/logging";
import { sanitizeSqlPattern } from "@/lib/security";

// =============================================================================
// Types
// =============================================================================

// Retell's actual request format
interface RetellFunctionRequest {
  call: {
    call_id: string;
    call_type: string;
    from_number: string;
    to_number: string;
    direction: string;
    agent_id: string;
    call_status: string;
    metadata: Record<string, string>;
    retell_llm_dynamic_variables?: Record<string, string>;
  };
  name: string;
  args: Record<string, unknown>;
}

// Our internal format
interface FunctionCallRequest {
  call_id: string;
  business_id: string;
  function_name: string;
  arguments: Record<string, unknown>;
  caller_number?: string;
}

interface FunctionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * Transform Retell's request format to our internal format
 */
function parseRetellRequest(retellBody: RetellFunctionRequest): FunctionCallRequest {
  return {
    // Use our internal koya_call_id (UUID), not Retell's call_id (string)
    call_id: retellBody.call?.metadata?.koya_call_id || "",
    business_id: retellBody.call?.metadata?.business_id || "",
    function_name: retellBody.name || "",
    arguments: retellBody.args || {},
    caller_number: retellBody.call?.from_number || "",
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get business personality for error message customization
 */
async function getBusinessPersonality(
  supabase: ReturnType<typeof createAdminClient>,
  businessId: string
): Promise<Personality> {
  try {
    const { data } = await supabase
      .from("ai_config")
      .select("personality")
      .eq("business_id", businessId)
      .single();

    const config = data as { personality: string } | null;
    if (config?.personality && ["professional", "friendly", "casual"].includes(config.personality)) {
      return config.personality as Personality;
    }
  } catch {
    // Default to professional on error
  }
  return "professional";
}

/**
 * Get personality-aware error message
 */
function getErrorMessage(
  errorType: ErrorType,
  personality: Personality,
  language: "en" | "es" = "en"
): string {
  return getFullErrorResponse(errorType, personality, language);
}

// =============================================================================
// POST - Handle Function Calls
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // Parse Retell's request format
    const rawBody = await request.json() as RetellFunctionRequest;
    const body = parseRetellRequest(rawBody);

    // Validate business_id
    if (!body.business_id) {
      return NextResponse.json({
        success: false,
        message: "I'm having trouble processing that request. Let me help you another way.",
      });
    }

    const adminSupabase = createAdminClient();
    let result: FunctionResult;

    switch (body.function_name) {
      case "find_next_available":
        result = await handleFindNextAvailable(adminSupabase, body);
        break;

      case "check_availability":
        result = await handleCheckAvailability(adminSupabase, body);
        break;

      case "book_appointment":
        result = await handleBookAppointment(adminSupabase, body);
        break;

      case "transfer_call":
        result = await handleTransferCall(adminSupabase, body);
        break;

      case "take_message":
        result = await handleTakeMessage(adminSupabase, body);
        break;

      case "send_sms":
        result = await handleSendSMS(adminSupabase, body);
        break;

      case "end_call":
        result = await handleEndCall(adminSupabase, body);
        break;

      default:
        result = {
          success: false,
          message: `Unknown function: ${body.function_name}`,
        };
    }

    return NextResponse.json(result);

  } catch (error) {
    logError("Retell Function", error);
    return NextResponse.json({
      success: false,
      message: "An error occurred processing this request",
    });
  }
}

// =============================================================================
// Function Handlers
// =============================================================================

/**
 * Find the next available appointment slot across multiple days
 */
async function handleFindNextAvailable(
  supabase: ReturnType<typeof createAdminClient>,
  body: FunctionCallRequest
): Promise<FunctionResult> {
  const { service, preferred_time } = body.arguments as {
    service?: string;
    preferred_time?: "morning" | "afternoon" | "evening" | "any";
  };

  try {
    // Get business timezone
    const { data: business } = await supabase
      .from("businesses")
      .select("timezone")
      .eq("id", body.business_id)
      .single();

    const businessData = business as { timezone: string } | null;
    const timezone = businessData?.timezone || "America/New_York";

    // Get service duration
    let serviceDuration = 30;
    if (service) {
      const { data: serviceData } = await supabase
        .from("services")
        .select("duration_minutes")
        .eq("business_id", body.business_id)
        .ilike("name", `%${sanitizeSqlPattern(String(service))}%`)
        .single();

      const serviceInfo = serviceData as { duration_minutes: number } | null;
      if (serviceInfo) {
        serviceDuration = serviceInfo.duration_minutes;
      }
    }

    // Get all business hours
    const { data: allHours } = await supabase
      .from("business_hours")
      .select("day_of_week, open_time, close_time, is_closed")
      .eq("business_id", body.business_id);

    const hoursMap = new Map<number, { open_time: string; close_time: string; is_closed: boolean }>();
    (allHours || []).forEach((h: { day_of_week: number; open_time: string; close_time: string; is_closed: boolean }) => {
      hoursMap.set(h.day_of_week, h);
    });

    // Search next 14 days
    const now = DateTime.now().setZone(timezone);
    const maxDays = 14;

    for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
      const checkDate = now.plus({ days: dayOffset });
      const dayOfWeek = checkDate.weekday % 7; // Convert to 0=Sun format

      const hours = hoursMap.get(dayOfWeek);
      if (!hours || hours.is_closed || !hours.open_time || !hours.close_time) {
        continue; // Skip closed days
      }

      // Parse open/close times
      const [openH, openM] = hours.open_time.split(":").map(Number);
      const [closeH, closeM] = hours.close_time.split(":").map(Number);

      let openTimeDt = checkDate.set({ hour: openH, minute: openM, second: 0 });
      const closeTimeDt = checkDate.set({ hour: closeH, minute: closeM, second: 0 });

      // For today, start from now (rounded up to next 30-min slot)
      if (dayOffset === 0) {
        const currentMinutes = now.hour * 60 + now.minute;
        const roundedMinutes = Math.ceil(currentMinutes / 30) * 30;
        const startHour = Math.floor(roundedMinutes / 60);
        const startMin = roundedMinutes % 60;
        const todayStart = checkDate.set({ hour: startHour, minute: startMin, second: 0 });
        if (todayStart > openTimeDt) {
          openTimeDt = todayStart;
        }
      }

      // Apply time preference filter
      let filterStart = openTimeDt;
      let filterEnd = closeTimeDt;
      if (preferred_time === "morning") {
        filterEnd = checkDate.set({ hour: 12, minute: 0, second: 0 });
      } else if (preferred_time === "afternoon") {
        filterStart = checkDate.set({ hour: 12, minute: 0, second: 0 });
        filterEnd = checkDate.set({ hour: 17, minute: 0, second: 0 });
      } else if (preferred_time === "evening") {
        filterStart = checkDate.set({ hour: 17, minute: 0, second: 0 });
      }

      // Adjust to be within business hours
      if (filterStart < openTimeDt) filterStart = openTimeDt;
      if (filterEnd > closeTimeDt) filterEnd = closeTimeDt;

      // Get existing appointments for that day
      const startOfDay = checkDate.startOf("day").toUTC().toISO();
      const endOfDay = checkDate.endOf("day").toUTC().toISO();

      const { data: appointments } = await supabase
        .from("appointments")
        .select("scheduled_at, duration_minutes")
        .eq("business_id", body.business_id)
        .gte("scheduled_at", startOfDay)
        .lte("scheduled_at", endOfDay)
        .neq("status", "cancelled");

      const appointmentsArray = (appointments || []) as Array<{
        scheduled_at: string;
        duration_minutes: number;
      }>;

      // Check external calendar
      let externalBusySlots: Array<{ start: Date; end: Date }> = [];
      try {
        const calendarClient = await createCalendarClient(body.business_id);
        if (calendarClient) {
          const freeBusy = await calendarClient.getFreeBusy({
            timeMin: filterStart.toJSDate(),
            timeMax: filterEnd.toJSDate(),
          });
          externalBusySlots = freeBusy.busy;
        }
      } catch {
        // Calendar not connected - continue
      }

      // Find first available slot
      let currentSlotDt = filterStart;
      while (currentSlotDt.plus({ minutes: serviceDuration }) <= filterEnd) {
        const currentSlot = currentSlotDt.toJSDate();
        const slotEnd = currentSlotDt.plus({ minutes: serviceDuration }).toJSDate();

        // Check for conflicts
        const hasDbConflict = appointmentsArray.some(apt => {
          const aptStart = new Date(apt.scheduled_at);
          const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000);
          return currentSlot < aptEnd && slotEnd > aptStart;
        });

        const hasCalendarConflict = externalBusySlots.some(busy => {
          return currentSlot < busy.end && slotEnd > busy.start;
        });

        if (!hasDbConflict && !hasCalendarConflict) {
          // Found an available slot!
          const dateStr = checkDate.toFormat("cccc, LLLL d"); // e.g., "Monday, January 15"
          const timeStr = currentSlotDt.toFormat("h:mm a"); // e.g., "2:30 PM"
          const isoDate = checkDate.toFormat("yyyy-MM-dd");

          return {
            success: true,
            message: `The next available appointment is ${dateStr} at ${timeStr}. Would you like me to book that for you?`,
            data: {
              date: isoDate,
              time: currentSlotDt.toFormat("HH:mm"),
              formattedDate: dateStr,
              formattedTime: timeStr,
            },
          };
        }

        currentSlotDt = currentSlotDt.plus({ minutes: 30 });
      }
    }

    // No availability found in next 14 days
    return {
      success: true,
      message: "I'm sorry, we're fully booked for the next two weeks. Would you like to leave a message and have someone call you back?",
    };

  } catch (_error) {
    const personality = await getBusinessPersonality(supabase, body.business_id);
    return {
      success: false,
      message: getErrorMessage("availability_check_failed", personality),
    };
  }
}

/**
 * Check availability for appointments
 * Spec Reference: Part 11, Lines 1396-1410
 */
async function handleCheckAvailability(
  supabase: ReturnType<typeof createAdminClient>,
  body: FunctionCallRequest
): Promise<FunctionResult> {
  const { date, service } = body.arguments as { date: string; service?: string };

  if (!date) {
    return {
      success: false,
      message: "I need a date to check availability. What date were you thinking?",
    };
  }

  try {
    // Get business timezone
    const { data: business } = await supabase
      .from("businesses")
      .select("timezone")
      .eq("id", body.business_id)
      .single();

    const businessData = business as { timezone: string } | null;
    const timezone = businessData?.timezone || "America/New_York";

    // Parse date in business timezone to get correct day of week
    const dateInTz = DateTime.fromISO(date, { zone: timezone });
    const dayOfWeek = dateInTz.weekday % 7; // Luxon uses 1=Mon, 7=Sun; convert to 0=Sun
    const { data: hours } = await supabase
      .from("business_hours")
      .select("open_time, close_time, is_closed")
      .eq("business_id", body.business_id)
      .eq("day_of_week", dayOfWeek)
      .single();

    const hoursData = hours as { open_time: string; close_time: string; is_closed: boolean } | null;
    if (!hoursData || hoursData.is_closed || !hoursData.open_time || !hoursData.close_time) {
      return {
        success: true,
        message: "We're closed on that day. Would you like to check another date?",
      };
    }

    // Get service duration (if specified)
    let serviceDuration = 30; // Default 30 minutes
    if (service) {
      const { data: serviceData } = await supabase
        .from("services")
        .select("duration_minutes")
        .eq("business_id", body.business_id)
        .ilike("name", `%${sanitizeSqlPattern(String(service))}%`)
        .single();

      const serviceInfo = serviceData as { duration_minutes: number } | null;
      if (serviceInfo) {
        serviceDuration = serviceInfo.duration_minutes;
      }
    }

    // Get existing appointments for that day (in UTC for DB query)
    const startOfDayTz = dateInTz.startOf("day");
    const endOfDayTz = dateInTz.endOf("day");
    const startOfDay = startOfDayTz.toUTC().toISO();
    const endOfDay = endOfDayTz.toUTC().toISO();

    const { data: appointments } = await supabase
      .from("appointments")
      .select("scheduled_at, duration_minutes")
      .eq("business_id", body.business_id)
      .gte("scheduled_at", startOfDay)
      .lte("scheduled_at", endOfDay)
      .neq("status", "cancelled");

    const appointmentsArray = (appointments || []) as Array<{
      scheduled_at: string;
      duration_minutes: number;
    }>;

    // Also check external calendar if connected (Google/Outlook)
    let externalBusySlots: Array<{ start: Date; end: Date }> = [];
    try {
      const calendarClient = await createCalendarClient(body.business_id);
      if (calendarClient) {
        const freeBusy = await calendarClient.getFreeBusy({
          timeMin: new Date(`${date}T${hoursData.open_time}`),
          timeMax: new Date(`${date}T${hoursData.close_time}`),
        });
        externalBusySlots = freeBusy.busy;
      }
    } catch {
      // Calendar not connected or error - continue with database only
    }

    // Generate available slots (in business timezone)
    const slots: string[] = [];

    // Parse open/close times in business timezone
    const [openHour, openMin] = hoursData.open_time.split(":").map(Number);
    const [closeHour, closeMin] = hoursData.close_time.split(":").map(Number);

    const openTimeDt = dateInTz.set({ hour: openHour, minute: openMin, second: 0 });
    const closeTimeDt = dateInTz.set({ hour: closeHour, minute: closeMin, second: 0 });

    let currentSlotDt = openTimeDt;
    while (currentSlotDt.plus({ minutes: serviceDuration }) <= closeTimeDt) {
      const currentSlot = currentSlotDt.toJSDate();
      const slotEnd = currentSlotDt.plus({ minutes: serviceDuration }).toJSDate();

      // Check database appointments
      const hasDbConflict = appointmentsArray.some(apt => {
        const aptStart = new Date(apt.scheduled_at);
        const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000);
        return currentSlot < aptEnd && slotEnd > aptStart;
      });

      // Check external calendar busy times
      const hasCalendarConflict = externalBusySlots.some(busy => {
        return currentSlot < busy.end && slotEnd > busy.start;
      });

      if (!hasDbConflict && !hasCalendarConflict) {
        // Format time in business timezone
        slots.push(currentSlotDt.toFormat("h:mm a"));
      }

      // Move to next 30-minute slot
      currentSlotDt = currentSlotDt.plus({ minutes: 30 });
    }

    if (slots.length === 0) {
      return {
        success: true,
        message: "We're fully booked on that date. Would you like to try another day?",
      };
    }

    // Return top 5 slots
    const topSlots = slots.slice(0, 5);
    return {
      success: true,
      message: `I have ${slots.length} openings on ${date}. The earliest available times are: ${topSlots.join(", ")}. Would any of those work for you?`,
      data: { availableSlots: slots },
    };

  } catch (_error) {
    const personality = await getBusinessPersonality(supabase, body.business_id);
    return {
      success: false,
      message: getErrorMessage("availability_check_failed", personality),
    };
  }
}

/**
 * Book an appointment
 * Spec Reference: Part 11, Lines 1411-1430
 */
async function handleBookAppointment(
  supabase: ReturnType<typeof createAdminClient>,
  body: FunctionCallRequest
): Promise<FunctionResult> {
  const {
    date,
    time,
    customer_name,
    customer_phone,
    customer_email,
    service,
    notes,
  } = body.arguments as {
    date: string;
    time: string;
    customer_name: string;
    customer_phone: string;
    customer_email?: string;
    service: string;
    notes?: string;
  };

  if (!date || !time || !customer_name || !customer_phone || !service) {
    return {
      success: false,
      message: "I need the date, time, your name, phone number, and service to book. What's missing?",
    };
  }

  try {
    // Get business info
    const { data: business } = await supabase
      .from("businesses")
      .select("timezone, name")
      .eq("id", body.business_id)
      .single();

    const businessData = business as { timezone: string; name: string } | null;

    // Find service
    const { data: serviceData } = await supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("business_id", body.business_id)
      .ilike("name", `%${sanitizeSqlPattern(String(service))}%`)
      .single();

    const serviceInfo = serviceData as { id: string; name: string; duration_minutes: number } | null;
    const serviceDuration = serviceInfo?.duration_minutes || 30;

    // Parse and create appointment datetime in business timezone
    const timezone = businessData?.timezone || "America/New_York";

    // Normalize time format - handle "2:00 PM", "2 PM", "14:00", etc.
    let normalizedTime = time;
    const timeMatch = time.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const period = timeMatch[3]?.toUpperCase();

      if (period === "PM" && hours !== 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;

      normalizedTime = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    }

    // Parse in business timezone, then convert to JS Date (UTC internally)
    const dt = DateTime.fromISO(`${date}T${normalizedTime}`, { zone: timezone });

    if (!dt.isValid) {
      throw new Error(`Invalid date/time: ${date} ${time}`);
    }

    // Validation: Can't book in the past
    const now = DateTime.now().setZone(timezone);

    if (dt < now) {
      return {
        success: false,
        message: "I can't book appointments in the past. Would you like to pick a future date and time?",
      };
    }

    // Validation: Can't book more than 90 days in advance
    const maxAdvanceDays = 90;
    if (dt > now.plus({ days: maxAdvanceDays })) {
      return {
        success: false,
        message: `I can only book appointments up to ${maxAdvanceDays} days in advance. Would you like to pick a closer date?`,
      };
    }

    // Validation: Check if within business hours
    const requestedDayOfWeek = dt.weekday % 7; // Convert to 0=Sun format
    const { data: hoursData } = await supabase
      .from("business_hours")
      .select("open_time, close_time, is_closed")
      .eq("business_id", body.business_id)
      .eq("day_of_week", requestedDayOfWeek)
      .single();

    const hours = hoursData as { open_time: string; close_time: string; is_closed: boolean } | null;
    if (!hours || hours.is_closed) {
      return {
        success: false,
        message: "We're closed on that day. Would you like to try a different date?",
      };
    }

    // Check if time is within open/close hours
    const [openH, openM] = hours.open_time.split(":").map(Number);
    const [closeH, closeM] = hours.close_time.split(":").map(Number);
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;
    const requestedMinutes = dt.hour * 60 + dt.minute;
    const endMinutes = requestedMinutes + serviceDuration;

    if (requestedMinutes < openMinutes || endMinutes > closeMinutes) {
      return {
        success: false,
        message: `That time is outside our business hours. We're open from ${hours.open_time} to ${hours.close_time}. Would you like to pick a time within those hours?`,
      };
    }

    const scheduledAt = dt.toJSDate();
    const scheduledEnd = new Date(scheduledAt.getTime() + serviceDuration * 60000);

    // Double-book prevention: Check for conflicts before booking
    // Check database appointments
    const { data: existingApts } = await supabase
      .from("appointments")
      .select("scheduled_at, duration_minutes")
      .eq("business_id", body.business_id)
      .neq("status", "cancelled")
      .gte("scheduled_at", dt.startOf("day").toUTC().toISO())
      .lte("scheduled_at", dt.endOf("day").toUTC().toISO());

    const hasDbConflict = (existingApts || []).some((apt: { scheduled_at: string; duration_minutes: number }) => {
      const aptStart = new Date(apt.scheduled_at);
      const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000);
      return scheduledAt < aptEnd && scheduledEnd > aptStart;
    });

    if (hasDbConflict) {
      return {
        success: false,
        message: "I'm sorry, that time slot just got booked. Would you like to try a different time?",
      };
    }

    // Check external calendar (if connected)
    try {
      const calendarClient = await createCalendarClient(body.business_id);
      if (calendarClient) {
        const { busy } = await calendarClient.getFreeBusy({
          timeMin: scheduledAt,
          timeMax: scheduledEnd,
        });

        const hasCalendarConflict = busy.some(slot => scheduledAt < slot.end && scheduledEnd > slot.start);
        if (hasCalendarConflict) {
          return {
            success: false,
            message: "That time conflicts with something on the calendar. Would you like to try a different time?",
          };
        }
      }
    } catch {
      // Calendar check failed - proceed with booking
    }

    // Only include call_id if it's a valid UUID (not empty or Retell's format)
    const callId = body.call_id && body.call_id.length === 36 ? body.call_id : null;

    const { data: appointment, error: aptError } = await (supabase.from("appointments") as any)
      .insert({
        business_id: body.business_id,
        call_id: callId,
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
        service_id: serviceInfo?.id,
        service_name: serviceInfo?.name || service,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: serviceDuration,
        status: "confirmed",
        notes: notes || null,
      })
      .select()
      .single();

    if (aptError) {
      logError("Book Appointment", aptError);
      throw new Error(`Failed to create appointment: ${aptError.message}`);
    }

    const aptData = appointment as { id: string; service_name: string } | null;
    if (!aptData) {
      throw new Error("Failed to create appointment: no data returned");
    }

    // Sync to external calendar (Google/Outlook)
    try {
      const endTime = new Date(scheduledAt.getTime() + serviceDuration * 60000);
      const externalEventId = await createAppointmentEvent(body.business_id, {
        summary: `${aptData.service_name} - ${customer_name}`,
        description: notes || `Booked via phone call. Customer: ${customer_name}, Phone: ${customer_phone}`,
        start: scheduledAt,
        end: endTime,
        customerEmail: customer_email,
        customerName: customer_name,
      });

      // Store external event ID for future sync/updates
      if (externalEventId) {
        await (supabase.from("appointments") as any)
          .update({ external_event_id: externalEventId })
          .eq("id", aptData.id);
      }
    } catch (_calendarError) {
      // Calendar sync failed but appointment is still booked in DB
      // Log silently - don't fail the booking
    }

    // Send confirmation SMS
    const formattedDate = scheduledAt.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const formattedTime = scheduledAt.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    try {
      await sendSMS({
        to: customer_phone,
        body: `Your appointment at ${businessData?.name || "our office"} is confirmed for ${formattedDate} at ${formattedTime}. Service: ${aptData.service_name}. Reply CANCEL to cancel.`,
        messageType: "booking_confirmation",
      });
    } catch (smsError) {
      // Log SMS failure but don't fail the booking
      logWarning(
        "Booking SMS",
        `Failed to send confirmation to ***${customer_phone.slice(-4)} for business ${body.business_id}: ${smsError instanceof Error ? smsError.message : "Unknown error"}`
      );
    }

    // Update call outcome
    if (body.call_id) {
      await (supabase.from("calls") as any)
        .update({ outcome: "booked" }).eq("id", body.call_id);
    }

    return {
      success: true,
      message: `I've booked your ${aptData.service_name} appointment for ${formattedDate} at ${formattedTime}. I'm sending a confirmation text to ${customer_phone}. Is there anything else I can help you with?`,
      data: {
        appointmentId: aptData.id,
        scheduledAt: scheduledAt.toISOString(),
        serviceName: aptData.service_name,
      },
    };

  } catch (error) {
    logError("Book Appointment", error);
    const personality = await getBusinessPersonality(supabase, body.business_id);
    return {
      success: false,
      message: getErrorMessage("booking_failed", personality),
    };
  }
}

/**
 * Transfer call to business owner
 * Spec Reference: Part 11, Lines 1431-1440
 */
async function handleTransferCall(
  supabase: ReturnType<typeof createAdminClient>,
  body: FunctionCallRequest
): Promise<FunctionResult> {
  const { reason } = body.arguments as { reason: string };

  try {
    // Get transfer settings
    const { data: callSettings } = await supabase
      .from("call_settings")
      .select("transfer_number")
      .eq("business_id", body.business_id)
      .single();

    const settingsData = callSettings as { transfer_number: string | null } | null;
    if (!settingsData?.transfer_number) {
      return {
        success: false,
        message: "I'm not able to transfer calls right now. Would you like to leave a message instead?",
      };
    }

    // Transferring call to owner

    return {
      success: true,
      message: "I'm transferring you now. Please hold.",
      data: {
        transferNumber: settingsData.transfer_number,
        reason,
      },
    };

  } catch (_error) {
    const personality = await getBusinessPersonality(supabase, body.business_id);
    return {
      success: false,
      message: getErrorMessage("transfer_failed", personality),
    };
  }
}

/**
 * Take a message
 * Spec Reference: Part 11, Lines 1491-1524
 */
async function handleTakeMessage(
  supabase: ReturnType<typeof createAdminClient>,
  body: FunctionCallRequest
): Promise<FunctionResult> {
  const { caller_name, caller_phone, message, urgency } = body.arguments as {
    caller_name: string;
    caller_phone: string;
    message: string;
    urgency: "low" | "normal" | "high" | "emergency";
  };

  if (!caller_name || !caller_phone || !message || !urgency) {
    return {
      success: false,
      message: "Let me make sure I have everything. Can you give me your name, phone number, and the message?",
    };
  }

  try {
    // Update call record with message
    if (body.call_id) {
      await (supabase.from("calls") as any)
        .update({
          outcome: "message",
          message_taken: message,
          lead_info: {
            name: caller_name,
            phone: caller_phone,
            urgency,
          },
        }).eq("id", body.call_id);
    }

    // Send SMS alert to business owner
    const { data: business } = await supabase
      .from("businesses")
      .select("user_id, name")
      .eq("id", body.business_id)
      .single();

    const businessData = business as { user_id: string; name: string } | null;
    if (businessData) {
      const { data: user } = await supabase
        .from("users")
        .select("phone")
        .eq("id", businessData.user_id)
        .single();

      const userData = user as { phone: string | null } | null;
      if (userData?.phone) {
        const urgencyEmoji = urgency === "emergency" ? "🚨" : urgency === "high" ? "⚠️" : urgency === "normal" ? "📞" : "📝";
        
        try {
          await sendSMS({
            to: userData.phone,
            body: `${urgencyEmoji} Message from ${caller_name} (${caller_phone}): "${message.substring(0, 100)}${message.length > 100 ? "..." : ""}"`,
            messageType: "message_alert",
          });
        } catch (smsError) {
          // Log SMS failure - this is important as it's a message alert to business owner
          logWarning(
            "Message Alert SMS",
            `Failed to send ${urgency} message alert to business owner for ${body.business_id}: ${smsError instanceof Error ? smsError.message : "Unknown error"}`
          );
        }
      }
    }

    return {
      success: true,
      message: `Got it! I'll make sure they get your message. ${urgency === "emergency" || urgency === "high" ? "I've marked this as urgent." : ""} Is there anything else you'd like me to add?`,
      data: {
        messageSaved: true,
        urgency,
        callerName: caller_name,
      },
    };

  } catch (_error) {
    const personality = await getBusinessPersonality(supabase, body.business_id);
    return {
      success: false,
      message: getErrorMessage("message_save_failed", personality),
    };
  }
}

/**
 * Send SMS to caller
 */
async function handleSendSMS(
  supabase: ReturnType<typeof createAdminClient>,
  body: FunctionCallRequest
): Promise<FunctionResult> {
  const { message, to_number } = body.arguments as {
    message: string;
    to_number?: string;
  };

  const targetNumber = to_number || body.caller_number;

  if (!message || !targetNumber) {
    return {
      success: false,
      message: "I need a message and phone number to send a text. What would you like me to send?",
    };
  }

  try {
    // Get business phone for sender
    const { data: phone } = await supabase
      .from("phone_numbers")
      .select("phone_number")
      .eq("business_id", body.business_id)
      .eq("status", "active")
      .single();

    const phoneData = phone as { phone_number: string } | null;
    
    await sendSMS({
      to: targetNumber,
      body: message,
      from: phoneData?.phone_number,
      messageType: "message_alert",
    });

    return {
      success: true,
      message: "I've sent that text message. Is there anything else I can help you with?",
      data: { sent: true },
    };

  } catch (_error) {
    const personality = await getBusinessPersonality(supabase, body.business_id);
    return {
      success: false,
      message: getErrorMessage("sms_failed", personality),
    };
  }
}

/**
 * End the call
 */
async function handleEndCall(
  supabase: ReturnType<typeof createAdminClient>,
  body: FunctionCallRequest
): Promise<FunctionResult> {
  const { reason } = body.arguments as { reason: string };

  try {
    // Update call record if we have one
    if (body.call_id) {
      const { data: call } = await supabase
        .from("calls")
        .select("outcome")
        .eq("id", body.call_id)
        .single();

      const callData = call as { outcome: string | null } | null;
      // Only update if no outcome set yet
      if (!callData?.outcome) {
        await (supabase.from("calls") as any)
          .update({ outcome: "info" }).eq("id", body.call_id);
      }
    }

    // Ending call gracefully

    return {
      success: true,
      message: "Thank you for calling. Have a great day!",
      data: { ended: true, reason },
    };

  } catch (_error) {
    return {
      success: true,
      message: "Goodbye!",
      data: { ended: true },
    };
  }
}
