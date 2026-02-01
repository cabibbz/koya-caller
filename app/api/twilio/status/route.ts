/**
 * Koya Caller - Twilio Call Status Webhook
 * Session 12: Full Twilio Integration
 * 
 * Handles call status updates from Twilio:
 * - initiated, ringing, answered, completed, busy, no-answer, failed, canceled
 * 
 * Used for:
 * - Tracking call metrics
 * - Triggering missed call notifications
 * - Updating call records
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendMissedCallAlert, formatPhoneDisplay } from "@/lib/twilio";
import { logError } from "@/lib/logging";
import { getDashboardUrl } from "@/lib/config";
import { storeFailedWebhook } from "@/lib/webhooks/retry";

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

/**
 * POST /api/twilio/status
 * Handle call status callbacks
 */
export async function POST(request: NextRequest) {
  try {
    const params = await parseTwilioParams(request);
    
    const _callSid = params.CallSid || "";
    const callStatus = params.CallStatus || "";
    const callDuration = parseInt(params.CallDuration || "0", 10);
    const fromNumber = params.From || "";
    const toNumber = params.To || params.Called || "";
    const _direction = params.Direction || "";
    const timestamp = params.Timestamp || new Date().toISOString();
    
    const supabase = createAdminClient();
    
    // Look up business from phone number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: phoneRecord } = await (supabase as any)
      .from("phone_numbers")
      .select("business_id")
      .eq("number", toNumber)
      .eq("is_active", true)
      .single() as { data: { business_id: string } | null };
    
    if (!phoneRecord?.business_id) {
      // Unknown number, just acknowledge
      return new Response("", { status: 200 });
    }
    
    const businessId = phoneRecord.business_id;
    
    // Handle different status types
    switch (callStatus) {
      case "completed":
        // Call completed normally - update call record if exists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("calls")
          .update({
            ended_at: timestamp,
            duration_seconds: callDuration,
            duration_minutes_billed: Math.ceil(callDuration / 60),
          })
          .eq("business_id", businessId)
          .eq("from_number", fromNumber)
          .is("ended_at", null)
          .order("started_at", { ascending: false })
          .limit(1);
        break;
        
      case "busy":
      case "no-answer":
      case "canceled":
        // Missed call - create record and optionally notify
        await handleMissedCall({
          supabase,
          businessId,
          fromNumber,
          toNumber,
          callStatus,
          timestamp,
        });
        break;
        
      case "failed":
        // Call failed - no action needed
        break;
        
      case "initiated":
      case "ringing":
      case "in-progress":
        // Normal status updates - no action needed
        break;
        
      default:
        // Unknown status - no action
    }
    
    // Always return 200 to acknowledge
    return new Response("", { status: 200 });
    
  } catch (error) {
    logError("Twilio Status", error);

    // Store the failed webhook for retry
    // Re-parse params for storage
    const params: Record<string, string> = {};
    try {
      const text = await request.clone().text();
      const formData = new URLSearchParams(text);
      formData.forEach((value, key) => {
        params[key] = value;
      });
    } catch {
      // Use empty object if parsing fails
    }

    const callStatus = params.CallStatus || "unknown";
    await storeFailedWebhook({
      source: "twilio",
      eventType: `call.${callStatus}`,
      payload: params as Record<string, unknown>,
      error: error instanceof Error ? error : new Error(String(error)),
    });

    // Still return 200 to prevent Twilio retries (we'll handle retry internally)
    return new Response("", { status: 200 });
  }
}

/**
 * Handle missed call - create record and send notification
 */
async function handleMissedCall(params: {
  supabase: ReturnType<typeof createAdminClient>;
  businessId: string;
  fromNumber: string;
  toNumber: string;
  callStatus: string;
  timestamp: string;
}) {
  const { supabase, businessId, fromNumber, toNumber, callStatus, timestamp } = params;

  // Create a call record for the missed call
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("calls")
    .insert({
      business_id: businessId,
      from_number: fromNumber,
      to_number: toNumber,
      started_at: timestamp,
      ended_at: timestamp,
      duration_seconds: 0,
      duration_minutes_billed: 0,
      outcome: "missed",
      summary: `Missed call (${callStatus})`,
    });

  // Check notification settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: notificationSettings } = await (supabase as any)
    .from("notification_settings")
    .select("sms_missed, email_missed")
    .eq("business_id", businessId)
    .single() as { data: { sms_missed: boolean; email_missed: boolean } | null };

  // Return early if both notifications are disabled
  if (!notificationSettings?.sms_missed && !notificationSettings?.email_missed) {
    return;
  }

  // Get business details and owner info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: business } = await (supabase as any)
    .from("businesses")
    .select("user_id, name")
    .eq("id", businessId)
    .single() as { data: { user_id: string; name: string } | null };

  if (!business?.user_id) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: user } = await (supabase as any)
    .from("users")
    .select("phone, email")
    .eq("id", business.user_id)
    .single() as { data: { phone: string | null; email: string | null } | null };

  // Format time for display
  const callTime = new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  // Send SMS alert if enabled and phone is available
  if (notificationSettings?.sms_missed && user?.phone) {
    const result = await sendMissedCallAlert({
      to: user.phone,
      from: toNumber,
      callerPhone: fromNumber,
      callTime,
    });

    if (result.success && result.sid) {
      // Record the SMS in database
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("sms_messages")
        .insert({
          business_id: businessId,
          direction: "outbound",
          message_type: "message_alert",
          from_number: toNumber,
          to_number: user.phone,
          body: `Missed call from ${formatPhoneDisplay(fromNumber)}`,
          twilio_sid: result.sid,
          status: "sent",
        });
    }
  }

  // Send email alert if enabled and email is available
  if (notificationSettings?.email_missed && user?.email) {
    const { sendMissedCallEmail } = await import("@/lib/email");
    await sendMissedCallEmail({
      to: user.email,
      businessName: business.name,
      callerPhone: formatPhoneDisplay(fromNumber),
      callTime,
      dashboardUrl: getDashboardUrl("/calls"),
    });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
