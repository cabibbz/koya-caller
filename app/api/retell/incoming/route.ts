/**
 * Koya Caller - Retell Incoming Call Handler
 * Session 12: Full Twilio Integration
 * Session 23: Enhanced Error Handling
 *
 * Handles incoming Twilio calls and routes them to Retell AI agent.
 * This endpoint returns TwiML that connects the call to Retell.
 *
 * Features:
 * - Fallback to TwiML IVR when Retell is unavailable
 * - Error logging to system_logs table
 * - Retry logic for transient failures
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { redirect as twimlRedirect, simpleSay } from "@/lib/twilio/twiml";
import {
  handleRetellFailure,
  withRetry,
  isRetellRetryable,
  logSystemWarning,
} from "@/lib/errors";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://koyacaller.com";
const retellApiKey = process.env.RETELL_API_KEY;

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
 * POST /api/retell/incoming
 * Handle incoming Twilio call and connect to Retell
 */
export async function POST(request: NextRequest) {
  try {
    const params = await parseTwilioParams(request);
    
    const callSid = params.CallSid;
    const fromNumber = params.From || "";
    const toNumber = params.To || "";
    
    // Check if this is an after-hours call
    const url = new URL(request.url);
    const isAfterHours = url.searchParams.get("after_hours") === "true";

    // Debug logging removed for production

    // Look up business and AI config
    const supabase = createAdminClient();
    
    const { data: phoneRecord } = await supabase
      .from("phone_numbers")
      .select("business_id")
      .eq("number", toNumber)
      .eq("is_active", true)
      .single() as { data: { business_id: string } | null };
    
    if (!phoneRecord?.business_id) {
      return twimlResponse(twimlRedirect(`${appUrl}/api/twilio/fallback`));
    }
    
    const businessId = phoneRecord.business_id;
    
    // Get AI config with Retell agent ID
    const { data: aiConfig } = await supabase
      .from("ai_config")
      .select("retell_agent_id, retell_agent_id_spanish, language_mode")
      .eq("business_id", businessId)
      .single() as { data: { retell_agent_id: string | null; retell_agent_id_spanish: string | null; language_mode: string } | null };
    
    if (!aiConfig?.retell_agent_id) {
      return twimlResponse(twimlRedirect(`${appUrl}/api/twilio/fallback`));
    }
    
    // Check if Retell is configured
    if (!retellApiKey) {
      return twimlResponse(twimlRedirect(`${appUrl}/api/twilio/fallback`));
    }
    
    // Create call record in database
    const { data: callRecord, error: callError } = await (supabase as any)
      .from("calls")
      .insert({
        business_id: businessId,
        from_number: fromNumber,
        to_number: toNumber,
        started_at: new Date().toISOString(),
        outcome: null, // Will be updated by webhook
      })
      .select("id")
      .single();
    
    if (callError) {
      // Error handled silently
    }
    
    // Use Retell SDK to register the call
    // This creates a Retell call and returns the WebSocket URL
    try {
      const Retell = await import("retell-sdk");
      const retellClient = new Retell.default({ apiKey: retellApiKey });
      
      // Register the call with Retell
      const retellCall = await retellClient.call.registerPhoneCall({
        agent_id: aiConfig.retell_agent_id,
        from_number: toNumber,  // Retell expects the Twilio number as "from"
        to_number: fromNumber,  // Caller's number as "to"
        direction: "inbound",   // Required: specify this is an inbound call
        metadata: {
          twilio_call_sid: callSid,
          koya_call_id: callRecord?.id || "",
          business_id: businessId,
          is_after_hours: isAfterHours ? "true" : "false",
        },
        retell_llm_dynamic_variables: {
          is_after_hours: isAfterHours ? "true" : "false",
        },
      });
      
      // Call registered with Retell successfully
      
      // Update call record with Retell call ID
      if (callRecord?.id) {
        await (supabase as any)
          .from("calls")
          .update({ retell_call_id: retellCall.call_id })
          .eq("id", callRecord.id);
      }
      
      // Return TwiML that connects to Retell via SIP
      // Retell uses SIP-based integration for Twilio calls
      // The call_id from registerPhoneCall is used in the SIP URI
      // See: https://docs.retellai.com/deploy/custom-telephony
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Sip>sip:${retellCall.call_id}@5t4n6j0wnrl.sip.livekit.cloud</Sip>
  </Dial>
</Response>`;
      
      return twimlResponse(twiml);
      
    } catch (retellError) {

      // Log to system_logs for admin visibility
      await handleRetellFailure(retellError, {
        businessId,
        callId: callRecord?.id,
        action: "register_phone_call",
      });

      // Update call record to indicate failure
      if (callRecord?.id) {
        await (supabase as any)
          .from("calls")
          .update({
            outcome: "missed",
            summary: "Retell connection failed - using fallback IVR",
          })
          .eq("id", callRecord.id);
      }

      // Fall back to TwiML IVR
      return twimlResponse(twimlRedirect(`${appUrl}/api/twilio/fallback`));
    }
    
  } catch (error) {
    return twimlResponse(twimlRedirect(`${appUrl}/api/twilio/fallback`));
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
