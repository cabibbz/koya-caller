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

// =============================================================================
// Types
// =============================================================================

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
    const body: FunctionCallRequest = await request.json();
    
    // Processing function call

    const adminSupabase = createAdminClient();
    let result: FunctionResult;

    switch (body.function_name) {
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

    // Get business hours for the day
    const dayOfWeek = new Date(date).getDay();
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
        .ilike("name", `%${service}%`)
        .single();

      const serviceInfo = serviceData as { duration_minutes: number } | null;
      if (serviceInfo) {
        serviceDuration = serviceInfo.duration_minutes;
      }
    }

    // Get existing appointments for that day
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;
    
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

    // Generate available slots
    const slots: string[] = [];
    const openTime = new Date(`${date}T${hoursData.open_time}`);
    const closeTime = new Date(`${date}T${hoursData.close_time}`);

    let currentSlot = new Date(openTime);
    while (currentSlot.getTime() + serviceDuration * 60000 <= closeTime.getTime()) {
      // Check if slot conflicts with existing appointment
      const slotEnd = new Date(currentSlot.getTime() + serviceDuration * 60000);
      
      const hasConflict = appointmentsArray.some(apt => {
        const aptStart = new Date(apt.scheduled_at);
        const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000);
        return currentSlot < aptEnd && slotEnd > aptStart;
      });

      if (!hasConflict) {
        slots.push(currentSlot.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }));
      }

      // Move to next 30-minute slot
      currentSlot = new Date(currentSlot.getTime() + 30 * 60000);
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

  } catch (error) {
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
      .ilike("name", `%${service}%`)
      .single();

    const serviceInfo = serviceData as { id: string; name: string; duration_minutes: number } | null;
    const serviceDuration = serviceInfo?.duration_minutes || 30;

    // Parse and create appointment datetime
    const scheduledAt = new Date(`${date}T${time}`);

    // Create appointment
    const { data: appointment, error: aptError } = await supabase
      .from("appointments")
      // @ts-ignore - Supabase generated types issue
      .insert({
        business_id: body.business_id,
        call_id: body.call_id || null,
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
        service_id: serviceInfo?.id,
        service_name: serviceInfo?.name || service,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: serviceDuration,
        status: "scheduled",
        notes: notes || null,
      })
      .select()
      .single();

    const aptData = appointment as { id: string; service_name: string } | null;
    if (aptError || !aptData) {
      throw new Error("Failed to create appointment");
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
      // Error handled silently
    }

    // Update call outcome
    if (body.call_id) {
      await supabase.from("calls")
        // @ts-ignore - Supabase generated types issue
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

  } catch (error) {
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
      await supabase.from("calls")
        // @ts-ignore - Supabase generated types issue
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
          // Error handled silently
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

  } catch (error) {
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

  } catch (error) {
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
        await supabase.from("calls")
          // @ts-ignore - Supabase generated types issue
          .update({ outcome: "info" }).eq("id", body.call_id);
      }
    }

    // Ending call gracefully

    return {
      success: true,
      message: "Thank you for calling. Have a great day!",
      data: { ended: true, reason },
    };

  } catch (error) {
    return {
      success: true,
      message: "Goodbye!",
      data: { ended: true },
    };
  }
}
