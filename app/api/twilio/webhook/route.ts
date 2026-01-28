/**
 * Koya Caller - Twilio Voice Webhook Handler
 * Session 12: Full Twilio Integration
 * 
 * Spec Reference: Part 12, Lines 1573-1594
 * 
 * This route handles incoming voice call webhooks from Twilio.
 * For voice calls, we check business status and either:
 * - Redirect to Retell for AI handling
 * - Play after-hours greeting
 * - Play minutes-exhausted message
 * - Fall back to TwiML IVR
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  generateFallbackGreeting,
  generateAfterHoursGreeting,
  generateMinutesExhaustedGreeting,
  redirect,
  simpleSay,
} from "@/lib/twilio/twiml";
import { logError } from "@/lib/logging";
import twilio from "twilio";
import { getAppUrl } from "@/lib/config";

const appUrl = getAppUrl();
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

// Helper to parse Twilio form data
async function parseTwilioParams(request: NextRequest): Promise<Record<string, string>> {
  const text = await request.text();
  const formData = new URLSearchParams(text);
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

// Helper to return TwiML response
function twimlResponse(xml: string): Response {
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
    },
  });
}

// Check if business is within business hours
function isWithinBusinessHours(
  hours: Array<{ day_of_week: number; is_closed: boolean; open_time: string | null; close_time: string | null }>,
  timezone: string
): boolean {
  try {
    // Get current time in business timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    
    const parts = formatter.formatToParts(now);
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    
    let dayOfWeek = 0;
    let hour = 0;
    let minute = 0;
    
    for (const part of parts) {
      if (part.type === "weekday") dayOfWeek = dayMap[part.value] ?? 0;
      if (part.type === "hour") hour = parseInt(part.value, 10);
      if (part.type === "minute") minute = parseInt(part.value, 10);
    }
    
    const currentMinutes = hour * 60 + minute;
    
    // Find hours for today
    const todayHours = hours.find((h) => h.day_of_week === dayOfWeek);
    
    if (!todayHours || todayHours.is_closed) {
      return false;
    }
    
    if (!todayHours.open_time || !todayHours.close_time) {
      return false;
    }
    
    // Parse open/close times
    const [openHour, openMin] = todayHours.open_time.split(":").map(Number);
    const [closeHour, closeMin] = todayHours.close_time.split(":").map(Number);
    
    const openMinutes = openHour * 60 + openMin;
    const closeMinutes = closeHour * 60 + closeMin;
    
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  } catch (_error) {
    return true; // Default to open on error
  }
}

/**
 * POST /api/twilio/webhook
 * Main voice call handler
 */
export async function POST(request: NextRequest) {
  try {
    // Clone the request to read body for both parsing and verification
    const clonedRequest = request.clone();
    const params = await parseTwilioParams(request);

    // Verify Twilio signature - required unless explicitly bypassed for local testing
    const allowBypass = process.env.WEBHOOK_SIGNATURE_BYPASS === "true" &&
                        process.env.NODE_ENV !== "production";

    if (TWILIO_AUTH_TOKEN && !allowBypass) {
      const signature = clonedRequest.headers.get("x-twilio-signature");
      const url = `${appUrl}/api/twilio/webhook`;

      const isValid = twilio.validateRequest(
        TWILIO_AUTH_TOKEN,
        signature || "",
        url,
        params
      );

      if (!isValid) {
        return new Response("Invalid signature", { status: 401 });
      }
    }

    const _callSid = params.CallSid;
    const _fromNumber = params.From || "";
    const toNumber = params.To || "";
    const _callStatus = params.CallStatus;

    // Incoming call received - processing
    
    // Look up business from phone number
    const supabase = createAdminClient();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: phoneRecord } = await (supabase as any)
      .from("phone_numbers")
      .select("business_id")
      .eq("number", toNumber)
      .eq("is_active", true)
      .single() as { data: { business_id: string } | null };
    
    if (!phoneRecord?.business_id) {
      return twimlResponse(simpleSay(
        "We're sorry, this number is not currently in service. Please check the number and try again."
      ));
    }
    
    // Get business details
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: business } = await (supabase as any)
      .from("businesses")
      .select(`
        id, name, timezone, subscription_status, plan_id,
        minutes_used_this_cycle, last_usage_alert_percent
      `)
      .eq("id", phoneRecord.business_id)
      .single() as { data: { id: string; name: string; timezone: string; subscription_status: string; plan_id: string | null; minutes_used_this_cycle: number; last_usage_alert_percent: number } | null };
    
    if (!business) {
      return twimlResponse(simpleSay(
        "We're sorry, this business is not currently available. Please try again later."
      ));
    }
    
    // Get plan to check minutes limit
    let includedMinutes = 200; // Default to starter
    if (business.plan_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: plan } = await (supabase as any)
        .from("plans")
        .select("included_minutes")
        .eq("id", business.plan_id)
        .single() as { data: { included_minutes: number } | null };
      
      if (plan) {
        includedMinutes = plan.included_minutes;
      }
    }
    
    // Check if minutes exhausted (allow some buffer for overage)
    const minutesUsed = business.minutes_used_this_cycle || 0;
    // Allow 10% overage before cutting off
    const maxMinutes = Math.floor(includedMinutes * 1.1);
    
    if (minutesUsed >= maxMinutes && business.subscription_status === "active") {
      
      // Get call settings for backup number
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: callSettings } = await (supabase as any)
        .from("call_settings")
        .select("transfer_number, backup_transfer_number")
        .eq("business_id", business.id)
        .single() as { data: { transfer_number: string | null; backup_transfer_number: string | null } | null };
      
      return twimlResponse(generateMinutesExhaustedGreeting({
        businessName: business.name,
        hasBackupNumber: !!(callSettings?.transfer_number || callSettings?.backup_transfer_number),
        backupNumber: callSettings?.transfer_number || callSettings?.backup_transfer_number || undefined,
        appUrl,
      }));
    }
    
    // Check business hours
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: businessHours } = await (supabase as any)
      .from("business_hours")
      .select("day_of_week, is_closed, open_time, close_time")
      .eq("business_id", business.id) as { data: Array<{ day_of_week: number; is_closed: boolean; open_time: string | null; close_time: string | null }> | null };
    
    const isOpen = !businessHours || businessHours.length === 0 || 
      isWithinBusinessHours(businessHours, business.timezone);
    
    // Get AI config to check if after-hours handling is enabled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: aiConfig } = await (supabase as any)
      .from("ai_config")
      .select("retell_agent_id, after_hours_greeting")
      .eq("business_id", business.id)
      .single() as { data: { retell_agent_id: string | null; after_hours_greeting: string | null } | null };

    // Get call settings for after-hours behavior
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: callSettings } = await (supabase as any)
      .from("call_settings")
      .select("after_hours_enabled, after_hours_can_book, after_hours_action, transfer_number, backup_transfer_number")
      .eq("business_id", business.id)
      .single() as { data: { after_hours_enabled: boolean; after_hours_can_book: boolean; after_hours_action: string | null; transfer_number: string | null; backup_transfer_number: string | null } | null };

    // Handle after-hours calls
    if (!isOpen) {
      const afterHoursAction = callSettings?.after_hours_action || "voicemail";

      // If action is "ai" and Retell is configured, let AI handle after-hours
      if (afterHoursAction === "ai" && aiConfig?.retell_agent_id) {
        // Pass after_hours flag via query param for Retell handler
        return twimlResponse(redirect(`${appUrl}/api/retell/incoming?after_hours=true`));
      }

      // If action is "transfer" and transfer number exists
      if (afterHoursAction === "transfer" && (callSettings?.transfer_number || callSettings?.backup_transfer_number)) {
        const transferTo = callSettings.transfer_number || callSettings.backup_transfer_number;
        return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Thank you for calling ${business.name}. We are currently closed. Please hold while we connect you.</Say>
  <Dial>${transferTo}</Dial>
</Response>`);
      }

      // Default: play after-hours greeting
      let hoursString: string | undefined;
      if (businessHours && businessHours.length > 0) {
        const openDays = businessHours.filter((h) => !h.is_closed);
        if (openDays.length > 0) {
          const first = openDays[0];
          if (first.open_time && first.close_time) {
            hoursString = `weekdays from ${formatTime(first.open_time)} to ${formatTime(first.close_time)}`;
          }
        }
      }

      return twimlResponse(generateAfterHoursGreeting({
        businessName: business.name,
        businessHours: hoursString,
        canBook: callSettings?.after_hours_can_book,
        appUrl,
      }));
    }

    // Business is open - If Retell agent is configured, redirect to Retell incoming handler
    if (aiConfig?.retell_agent_id) {
      // The Retell incoming handler will deal with the call
      return twimlResponse(redirect(`${appUrl}/api/retell/incoming`));
    }

    // No Retell agent - use fallback greeting (business is open, no AI)
    return twimlResponse(generateFallbackGreeting({
      businessName: business.name,
      hasBackupNumber: !!(callSettings?.transfer_number || callSettings?.backup_transfer_number),
      appUrl,
    }));
    
  } catch (error) {
    logError("Twilio Webhook", error);
    return twimlResponse(simpleSay(
      "We apologize, but we are experiencing technical difficulties. Please try your call again later."
    ));
  }
}

// Format time for speech (e.g., "09:00" -> "9 AM")
function formatTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  
  if (minute === 0) {
    return `${displayHour} ${period}`;
  }
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
}

// Prevent other HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
