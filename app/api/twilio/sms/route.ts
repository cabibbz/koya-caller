/**
 * Koya Caller - SMS Webhook Handler
 * Session 12: Full Twilio Integration
 *
 * Handles:
 * - Incoming SMS messages (from customers)
 * - SMS delivery status callbacks
 * - TCPA compliance (STOP/START keyword handling)
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { recordOptOut, recordOptIn } from "@/lib/db/sms-opt-outs";
import { logError } from "@/lib/logging";

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

/**
 * POST /api/twilio/sms
 * Handle incoming SMS or status callback
 */
export async function POST(request: NextRequest) {
  try {
    const params = await parseTwilioParams(request);
    
    // Check if this is a status callback or incoming message
    const messageStatus = params.MessageStatus;
    const _messageSid = params.MessageSid || params.SmsSid;
    
    if (messageStatus) {
      // This is a status callback
      return handleStatusCallback(params);
    } else {
      // This is an incoming message
      return handleIncomingMessage(params);
    }
    
  } catch (_error) {
    // Return empty TwiML response (don't auto-reply on error)
    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
  }
}

/**
 * Handle incoming SMS message
 */
async function handleIncomingMessage(params: Record<string, string>): Promise<Response> {
  const fromNumber = params.From || "";
  const toNumber = params.To || "";
  const body = params.Body || "";
  const messageSid = params.MessageSid || params.SmsSid || "";
  
  const supabase = createAdminClient();
  
  // Look up business from phone number
  const { data: phoneRecord } = await supabase
    .from("phone_numbers")
    .select("business_id")
    .eq("number", toNumber)
    .eq("is_active", true)
    .single() as { data: { business_id: string } | null };
  
  if (!phoneRecord?.business_id) {
    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
  }
  
  // Store the incoming message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
  await (supabase as any)
    .from("sms_messages")
    .insert({
      business_id: phoneRecord.business_id,
      direction: "inbound",
      message_type: "message_alert", // Generic type for inbound
      from_number: fromNumber,
      to_number: toNumber,
      body: body,
      twilio_sid: messageSid,
      status: "delivered",
    });
  
  // Check for CANCEL keyword (appointment cancellation)
  const normalizedBody = body.trim().toUpperCase();
  
  if (normalizedBody === "CANCEL" || normalizedBody === "CANCELAR") {
    // Look for recent appointments from this phone number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: appointments } = await (supabase as any)
      .from("appointments")
      .select("id, service_name, scheduled_at")
      .eq("business_id", phoneRecord.business_id)
      .eq("customer_phone", fromNumber)
      .eq("status", "confirmed")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1) as { data: Array<{ id: string; service_name: string; scheduled_at: string }> | null };
    
    if (appointments && appointments.length > 0) {
      const appt = appointments[0];
      
      // Cancel the appointment
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      await (supabase as any)
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appt.id);
      
      // Send confirmation reply
      const formattedDate = new Date(appt.scheduled_at).toLocaleDateString();
      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Your appointment for ${appt.service_name} on ${formattedDate} has been cancelled. Reply with any questions.</Message>
</Response>`);
    } else {
      return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>No upcoming appointments found for this number. Reply with any questions.</Message>
</Response>`);
    }
  }
  
  // Check for STOP keyword (unsubscribe - required for A2P/TCPA compliance)
  if (normalizedBody === "STOP" || normalizedBody === "UNSUBSCRIBE" || normalizedBody === "QUIT" || normalizedBody === "END" || normalizedBody === "CANCEL SMS") {
    // Record opt-out in our database for internal tracking
    // Twilio also handles STOP automatically, but we track internally for compliance
    try {
      await recordOptOut(supabase, phoneRecord.business_id, fromNumber, normalizedBody, 'sms');
    } catch (optOutError) {
      logError("SMS Opt-Out", optOutError);
      // Continue even if recording fails - Twilio still blocks
    }

    // Get business name for confirmation message
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: business } = await (supabase as any)
      .from("businesses")
      .select("name")
      .eq("id", phoneRecord.business_id)
      .single() as { data: { name: string } | null };

    const businessName = business?.name || "This service";

    // Send confirmation (Twilio may also send their own)
    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${businessName}: You have been unsubscribed and will not receive any more messages. Reply START to resubscribe.</Message>
</Response>`);
  }

  // Check for START keyword (re-subscribe)
  if (normalizedBody === "START" || normalizedBody === "UNSTOP" || normalizedBody === "SUBSCRIBE") {
    // Record opt-in in our database
    try {
      await recordOptIn(supabase, phoneRecord.business_id, fromNumber);
    } catch (optInError) {
      logError("SMS Opt-In", optInError);
    }

    // Get business name for confirmation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: business } = await (supabase as any)
      .from("businesses")
      .select("name")
      .eq("id", phoneRecord.business_id)
      .single() as { data: { name: string } | null };

    const businessName = business?.name || "This service";

    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${businessName}: You have been resubscribed to messages. Reply STOP to unsubscribe at any time.</Message>
</Response>`);
  }
  
  // Check for HELP keyword (required for A2P compliance)
  if (normalizedBody === "HELP" || normalizedBody === "AYUDA") {
    // Get business name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: business } = await (supabase as any)
      .from("businesses")
      .select("name")
      .eq("id", phoneRecord.business_id)
      .single() as { data: { name: string } | null };
    
    const businessName = business?.name || "Our business";
    
    return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${businessName} SMS Service. Reply CANCEL to cancel appointments. Reply STOP to unsubscribe. Contact us for more help.</Message>
</Response>`);
  }
  
  // For other messages, don't auto-reply
  // (Could potentially forward to business owner in future)
  return twimlResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
}

/**
 * Handle SMS delivery status callback
 */
async function handleStatusCallback(params: Record<string, string>): Promise<Response> {
  const messageSid = params.MessageSid || params.SmsSid || "";
  const messageStatus = params.MessageStatus || "";
  const _errorCode = params.ErrorCode;
  const _errorMessage = params.ErrorMessage;
  
  // Update message status in database
  const supabase = createAdminClient();
  
  // Map Twilio status to our status
  let dbStatus: "sent" | "delivered" | "failed" = "sent";
  if (messageStatus === "delivered" || messageStatus === "read") {
    dbStatus = "delivered";
  } else if (messageStatus === "failed" || messageStatus === "undelivered") {
    dbStatus = "failed";
  }
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
  const { error: _error } = await (supabase as any)
    .from("sms_messages")
    .update({ status: dbStatus })
    .eq("twilio_sid", messageSid);
  
  // Return empty response (status callbacks don't need TwiML)
  return new Response("", { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
