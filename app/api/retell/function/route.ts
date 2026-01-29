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
import { verifyWebhookSignature } from "@/lib/retell";
import {
  getFullErrorResponse,
  type Personality,
  type ErrorType,
} from "@/lib/claude/error-templates";
import { createCalendarClient, createAppointmentEvent } from "@/lib/calendar";
import {
  checkInventory,
  checkOrderStatus,
  createLead,
  checkReservationAvailability,
  processPayment,
} from "@/lib/integrations/manager";
import { DateTime } from "luxon";
import { logError, logWarning } from "@/lib/logging";
import { sanitizeSqlPattern } from "@/lib/security";
import { onAppointmentBooked, onMessageTaken, onLeadCaptured } from "@/lib/webhooks";
import {
  validateBookAppointment,
  validateCheckAvailability,
  validateTakeMessage,
  validateSendSms,
  validateSendEmail,
  validateCreateLead,
  validateCheckReservation,
  validateServiceExists,
  validateCheckInventory,
  validateCheckOrderStatus,
  validateProcessPayment,
  validateTransferCall,
  validateEndCall,
} from "@/lib/retell/validation";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Safely parse time string in "HH:MM" format
 * Returns [hours, minutes] or [0, 0] if invalid
 */
function parseTimeString(timeStr: string | null | undefined): [number, number] {
  if (!timeStr || typeof timeStr !== "string") {
    return [0, 0];
  }
  const parts = timeStr.split(":");
  if (parts.length < 2) {
    return [0, 0];
  }
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  // Validate ranges
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return [0, 0];
  }
  return [hours, minutes];
}

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
    // Get raw body for signature verification
    const payload = await request.text();
    const signature = request.headers.get("x-retell-signature");

    // Verify Retell webhook signature - required unless explicitly bypassed for local testing
    const verified = verifyWebhookSignature(payload, signature);
    const allowBypass = process.env.WEBHOOK_SIGNATURE_BYPASS === "true" &&
                        process.env.NODE_ENV !== "production";

    if (!verified && !allowBypass) {
      logWarning("Retell Function", "Invalid or missing webhook signature");
      return NextResponse.json(
        { success: false, message: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse Retell's request format
    const rawBody = JSON.parse(payload) as RetellFunctionRequest;
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

      case "send_email":
        result = await handleSendEmail(adminSupabase, body);
        break;

      case "end_call":
        result = await handleEndCall(adminSupabase, body);
        break;

      // Integration functions
      case "check_inventory":
        result = await handleCheckInventory(body);
        break;

      case "check_order_status":
        result = await handleCheckOrderStatus(body);
        break;

      case "create_lead":
        result = await handleCreateLead(body);
        break;

      case "check_reservation_availability":
        result = await handleCheckReservationAvailability(body);
        break;

      case "process_payment":
        result = await handleProcessPayment(body);
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

      // Parse open/close times safely
      const [openH, openM] = parseTimeString(hours.open_time);
      const [closeH, closeM] = parseTimeString(hours.close_time);

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
  // Validate inputs with Zod schema
  const validation = validateCheckAvailability(body.arguments);

  if (!validation.success) {
    return {
      success: false,
      message: validation.error,
    };
  }

  const { date, service } = validation.data;

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

    // Parse open/close times safely in business timezone
    const [openHour, openMin] = parseTimeString(hoursData.open_time);
    const [closeHour, closeMin] = parseTimeString(hoursData.close_time);

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
  // Validate inputs with Zod schema
  const validation = validateBookAppointment(body.arguments);

  if (!validation.success) {
    return {
      success: false,
      message: validation.error,
    };
  }

  const {
    date,
    time,
    customer_name,
    customer_phone,
    customer_email,
    service,
    notes,
  } = validation.data;

  try {
    // Validate service exists for this business
    const serviceValidation = await validateServiceExists(body.business_id, service);

    if (!serviceValidation.exists) {
      return {
        success: false,
        message: serviceValidation.suggestion || "I couldn't find that service. Which service would you like to book?",
      };
    }

    // Get business info
    const { data: business } = await supabase
      .from("businesses")
      .select("timezone, name")
      .eq("id", body.business_id)
      .single();

    const businessData = business as { timezone: string; name: string } | null;

    // Use validated service info
    const serviceInfo = serviceValidation.service!;
    const serviceDuration = serviceInfo.duration_minutes;

    // Parse and create appointment datetime in business timezone
    const timezone = businessData?.timezone || "America/New_York";

    // Normalize time format - handle "2:00 PM", "2 PM", "14:00", etc.
    let normalizedTime = time;
    const timeMatch = time.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM|am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const period = timeMatch[3]?.toUpperCase();

      // Validate parsed values
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new Error(`Invalid time format: ${time}`);
      }

      if (period === "PM" && hours !== 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;

      // Re-validate after AM/PM adjustment
      if (hours > 23) hours = 23;

      normalizedTime = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    } else {
      // If no regex match, the time format is unrecognized
      throw new Error(`Unrecognized time format: ${time}`);
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

    // Check if time is within open/close hours (parse safely)
    const [openH, openM] = parseTimeString(hours.open_time);
    const [closeH, closeM] = parseTimeString(hours.close_time);
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

    // Fire webhook for appointment booked (for Zapier/Make integrations)
    onAppointmentBooked(body.business_id, {
      appointment_id: aptData.id,
      customer_name,
      customer_phone,
      customer_email,
      service: aptData.service_name,
      date: formattedDate,
      time: formattedTime,
      notes,
    }).catch((err) => logError("Webhook Dispatch", err));

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
  // Validate inputs - reason is required
  const validation = validateTransferCall({
    ...body.arguments,
    // Provide the configured transfer number as default if not specified
    transfer_to: (body.arguments as { transfer_to?: string }).transfer_to || "placeholder",
  });

  // Extract reason even if full validation fails (transfer_to may not be in args)
  const reason = (body.arguments as { reason?: string }).reason || "Customer requested transfer";

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

    return {
      success: true,
      message: "I'm transferring you now. Please hold.",
      data: {
        transferNumber: settingsData.transfer_number,
        reason: validation.success ? validation.data.reason : reason,
        warmTransfer: validation.success ? validation.data.warm_transfer : false,
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
  // Validate inputs with Zod schema
  const validation = validateTakeMessage(body.arguments);

  if (!validation.success) {
    return {
      success: false,
      message: validation.error,
    };
  }

  const { caller_name, caller_phone, message, urgency } = validation.data;

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

    // Fire webhook for message taken (for Zapier/Make integrations)
    onMessageTaken(body.business_id, {
      caller_name,
      caller_phone,
      message,
      urgency: urgency === "normal" ? "medium" : urgency === "emergency" ? "high" : urgency,
      call_id: body.call_id,
    }).catch((err) => logError("Webhook Dispatch", err));

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
  // Add caller_number to arguments for validation if to_number not provided
  const argsWithCallerNumber = {
    ...body.arguments,
    to_number: (body.arguments as { to_number?: string }).to_number || body.caller_number,
  };

  // Validate inputs with Zod schema
  const validation = validateSendSms(argsWithCallerNumber);

  if (!validation.success) {
    return {
      success: false,
      message: validation.error,
    };
  }

  const { message, to_number } = validation.data;
  const targetNumber = to_number || body.caller_number;

  if (!targetNumber) {
    return {
      success: false,
      message: "I need a phone number to send the text to. What number should I use?",
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
 * Send email via Nylas (connected business email account)
 */
async function handleSendEmail(
  supabase: ReturnType<typeof createAdminClient>,
  body: FunctionCallRequest
): Promise<FunctionResult> {
  // Validate inputs with Zod schema
  const validation = validateSendEmail(body.arguments);

  if (!validation.success) {
    return {
      success: false,
      message: validation.error,
    };
  }

  const { to_email, subject, body: emailBody } = validation.data;

  try {
    // Get the business's Nylas grant_id from calendar_integrations
    const { data: integration } = await supabase
      .from("calendar_integrations")
      .select("grant_id, grant_email, grant_status")
      .eq("business_id", body.business_id)
      .single();

    const integrationData = integration as { grant_id: string | null; grant_email: string | null; grant_status: string | null } | null;

    if (!integrationData?.grant_id || integrationData.grant_status !== "active") {
      return {
        success: false,
        message: "I'm not able to send emails right now. Would you like me to send a text message instead?",
      };
    }

    // Import and use Nylas sendMessage
    const { sendMessage } = await import("@/lib/nylas/messages");

    await sendMessage(integrationData.grant_id, {
      to: [{ email: to_email }],
      subject,
      body: emailBody,
    });

    return {
      success: true,
      message: `I've sent that email to ${to_email}. Is there anything else I can help you with?`,
      data: { sent: true, to: to_email },
    };

  } catch (error) {
    logError("Send Email", error);
    const personality = await getBusinessPersonality(supabase, body.business_id);
    return {
      success: false,
      message: "I wasn't able to send that email. Would you like me to send a text message instead?",
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
  // Validate inputs
  const validation = validateEndCall(body.arguments);

  // Use validated data or defaults
  const reason = validation.success ? validation.data.reason : "completed";
  const summary = validation.success ? validation.data.summary : undefined;
  const followUpRequired = validation.success ? validation.data.follow_up_required : false;

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
          .update({
            outcome: "info",
            end_reason: reason,
            summary: summary,
            follow_up_required: followUpRequired,
          }).eq("id", body.call_id);
      }
    }

    return {
      success: true,
      message: "Thank you for calling. Have a great day!",
      data: {
        ended: true,
        reason,
        summary,
        followUpRequired,
      },
    };

  } catch (_error) {
    return {
      success: true,
      message: "Goodbye!",
      data: { ended: true },
    };
  }
}

// =============================================================================
// Integration Function Handlers
// =============================================================================

/**
 * Check inventory for a product
 */
async function handleCheckInventory(
  body: FunctionCallRequest
): Promise<FunctionResult> {
  // Validate inputs with Zod schema
  const validation = validateCheckInventory(body.arguments);

  if (!validation.success) {
    return {
      success: false,
      message: validation.error,
    };
  }

  const { product_name, quantity } = validation.data;

  const result = await checkInventory(
    body.business_id,
    product_name,
    quantity
  );

  return {
    success: result.available,
    message: result.message,
    data: {
      available: result.available,
      quantity: result.quantity,
      productName: result.productName,
      price: result.price,
    },
  };
}

/**
 * Check order status
 */
async function handleCheckOrderStatus(
  body: FunctionCallRequest
): Promise<FunctionResult> {
  // Validate inputs with Zod schema
  const validation = validateCheckOrderStatus(body.arguments);

  if (!validation.success) {
    return {
      success: false,
      message: validation.error,
    };
  }

  const { order_id, customer_phone, customer_email } = validation.data;

  // Use caller's phone if no phone provided in validation data
  const phone = customer_phone || body.caller_number;

  const result = await checkOrderStatus(
    body.business_id,
    order_id,
    phone
  );

  return {
    success: result.found,
    message: result.message,
    data: {
      found: result.found,
      orderNumber: result.orderNumber,
      status: result.status,
      items: result.items,
      trackingNumber: result.trackingNumber,
      customerEmail: customer_email,
    },
  };
}

/**
 * Create a lead in CRM
 */
async function handleCreateLead(
  body: FunctionCallRequest
): Promise<FunctionResult> {
  // Validate inputs with Zod schema
  const validation = validateCreateLead(body.arguments);

  if (!validation.success) {
    return {
      success: false,
      message: validation.error,
    };
  }

  const { name, email, phone, interest, notes } = validation.data;

  const result = await createLead(body.business_id, {
    name,
    email,
    phone,
    interest,
    notes,
  });

  // Fire webhook for lead captured (for Zapier/Make integrations)
  // This fires regardless of whether CRM integration is connected
  if (result.success) {
    onLeadCaptured(body.business_id, {
      name,
      email,
      phone,
      interest,
      notes,
      source: "phone_call",
    }).catch((err) => logError("Webhook Dispatch", err));
  }

  return {
    success: result.success,
    message: result.message,
    data: {
      leadId: result.leadId,
    },
  };
}

/**
 * Check reservation availability
 */
async function handleCheckReservationAvailability(
  body: FunctionCallRequest
): Promise<FunctionResult> {
  // Validate inputs with Zod schema
  const validation = validateCheckReservation(body.arguments);

  if (!validation.success) {
    return {
      success: false,
      message: validation.error,
    };
  }

  const { date, time, party_size } = validation.data;

  const result = await checkReservationAvailability(
    body.business_id,
    date,
    party_size,
    time
  );

  return {
    success: result.available,
    message: result.message,
    data: {
      available: result.available,
      times: result.times,
    },
  };
}

/**
 * Process a payment (deposit, balance, or full payment)
 * Enhanced to support Stripe Connect destination charges
 */
async function handleProcessPayment(
  body: FunctionCallRequest
): Promise<FunctionResult> {
  // Validate inputs with Zod schema
  const validation = validateProcessPayment({
    ...body.arguments,
    // Provide defaults for optional fields
    amount_cents: (body.arguments as { amount_cents?: number }).amount_cents || 5000,
    payment_type: (body.arguments as { payment_type?: string }).payment_type || "full",
  });

  // Even if validation fails on some fields, extract what we can
  const amount_cents = validation.success
    ? validation.data.amount_cents
    : (body.arguments as { amount_cents?: number }).amount_cents || 5000;
  const payment_type = validation.success
    ? validation.data.payment_type
    : ((body.arguments as { payment_type?: string }).payment_type as "deposit" | "balance" | "full") || "full";
  const appointment_id = validation.success
    ? validation.data.appointment_id
    : (body.arguments as { appointment_id?: string }).appointment_id;
  const description = validation.success
    ? validation.data.description
    : (body.arguments as { description?: string }).description;

  // Get caller's phone number (use validated if available)
  const customerPhone = validation.success
    ? validation.data.customer_phone || body.caller_number
    : body.caller_number;

  if (!customerPhone) {
    return {
      success: false,
      message: "I don't have a phone number to send the payment link to. Could you provide your phone number?",
    };
  }

  const supabase = createAdminClient();

  // Handle deposit payments for appointments
  if (payment_type === "deposit") {
    if (!appointment_id) {
      return {
        success: false,
        message: "I need to know which appointment this deposit is for. Would you like me to book an appointment first?",
      };
    }

    // Import Stripe Connect functions
    const { collectDeposit, getConnectAccountForBusiness } = await import("@/lib/stripe/connect");

    // Check if Stripe Connect is configured
    const connectAccount = await getConnectAccountForBusiness(body.business_id);
    if (!connectAccount || !connectAccount.isActive) {
      // Fall back to legacy payment processing
      const legacyResult = await processPayment(
        body.business_id,
        (amount_cents || 5000) / 100,
        description || "Appointment deposit",
        customerPhone,
        true
      );
      return {
        success: legacyResult.success,
        message: legacyResult.message,
        data: { paymentLink: legacyResult.paymentLink },
      };
    }

    // Get default deposit amount if not specified
    let depositAmount: number;
    if (amount_cents && amount_cents > 0) {
      depositAmount = amount_cents;
    } else {
      const { data: settings } = await (supabase as any)
        .from("payment_settings")
        .select("deposit_amount_cents, deposit_type, deposit_percentage")
        .eq("business_id", body.business_id)
        .single();

      depositAmount = settings?.deposit_amount_cents || 5000; // Default $50
    }

    const result = await collectDeposit(appointment_id, depositAmount);

    if (result.success && result.paymentLink) {
      // Send payment link via SMS
      try {
        const { sendSMS } = await import("@/lib/twilio");
        await sendSMS({
          to: customerPhone,
          body: `Here's your secure payment link for your $${(depositAmount / 100).toFixed(2)} deposit: ${result.paymentLink}`,
          messageType: "booking_confirmation",
          businessId: body.business_id,
        });
      } catch (smsError) {
        logWarning("Process Payment", `SMS send failed: ${smsError}`);
      }
    }

    return {
      success: result.success,
      message: result.success
        ? `I've sent a secure payment link to your phone for the $${(depositAmount / 100).toFixed(2)} deposit. Please click the link to complete your payment.`
        : result.message,
      data: { paymentLink: result.paymentLink },
    };
  }

  // Handle balance payments for appointments
  if (payment_type === "balance") {
    if (!appointment_id) {
      return {
        success: false,
        message: "I need to know which appointment to collect the balance for. Can you provide more details?",
      };
    }

    const { collectBalance, getConnectAccountForBusiness } = await import("@/lib/stripe/connect");

    // Check if Stripe Connect is configured
    const connectAccount = await getConnectAccountForBusiness(body.business_id);
    if (!connectAccount || !connectAccount.isActive) {
      return {
        success: false,
        message: "I'm not able to process balance payments right now. Would you like me to take a message and have someone call you back?",
      };
    }

    const result = await collectBalance(appointment_id);

    if (result.success && result.paymentLink) {
      // Send payment link via SMS
      try {
        const { sendSMS } = await import("@/lib/twilio");
        await sendSMS({
          to: customerPhone,
          body: `Here's your secure payment link for your remaining balance: ${result.paymentLink}`,
          messageType: "booking_confirmation",
          businessId: body.business_id,
        });
      } catch (smsError) {
        logWarning("Process Payment", `SMS send failed: ${smsError}`);
      }
    }

    return {
      success: result.success,
      message: result.success
        ? "I've sent a secure payment link to your phone for the remaining balance. Please click the link to complete your payment."
        : result.message,
      data: { paymentLink: result.paymentLink },
    };
  }

  // Handle full/general payments (legacy flow or one-time payments)
  if (!amount_cents && !description) {
    return {
      success: false,
      message: "I need to know the amount and what the payment is for. Could you confirm those details?",
    };
  }

  // Try Stripe Connect first
  const { createPaymentLink, getConnectAccountForBusiness } = await import("@/lib/stripe/connect");
  const connectAccount = await getConnectAccountForBusiness(body.business_id);

  if (connectAccount?.isActive && amount_cents) {
    try {
      const paymentLink = await createPaymentLink({
        businessId: body.business_id,
        amountCents: amount_cents,
        description: description || "Payment",
        customerPhone,
        paymentType: "full",
      });

      // Send via SMS
      const { sendSMS } = await import("@/lib/twilio");
      await sendSMS({
        to: customerPhone,
        body: `Here's your secure payment link for $${(amount_cents / 100).toFixed(2)}: ${paymentLink}`,
        messageType: "booking_confirmation",
        businessId: body.business_id,
      });

      return {
        success: true,
        message: `I've sent a secure payment link to your phone for $${(amount_cents / 100).toFixed(2)}. Please click the link to complete your payment.`,
        data: { paymentLink },
      };
    } catch (connectError) {
      logWarning("Process Payment", `Connect payment failed, falling back: ${connectError}`);
    }
  }

  // Fall back to legacy payment processing
  const legacyAmount = amount_cents ? amount_cents / 100 : 0;
  if (!legacyAmount || !description) {
    return {
      success: false,
      message: "I need to know the amount and what the payment is for. Could you confirm those details?",
    };
  }

  const result = await processPayment(
    body.business_id,
    legacyAmount,
    description,
    customerPhone,
    true
  );

  return {
    success: result.success,
    message: result.message,
    data: { paymentLink: result.paymentLink },
  };
}
