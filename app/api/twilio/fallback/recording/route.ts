/**
 * Koya Caller - TwiML Recording Handler
 * Session 12: Full Twilio Integration
 * 
 * Handles completed recordings from fallback IVR
 * - Saves recording URL to database
 * - Sends SMS alert to business owner
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateRecordingComplete, simpleSay } from "@/lib/twilio/twiml";
import { sendMessageAlert, formatPhoneDisplay } from "@/lib/twilio";

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
 * POST /api/twilio/fallback/recording
 * Handle completed recording
 */
export async function POST(request: NextRequest) {
  try {
    const params = await parseTwilioParams(request);
    
    const recordingUrl = params.RecordingUrl;
    const recordingDuration = parseInt(params.RecordingDuration || "0", 10);
    const _callSid = params.CallSid;
    const fromNumber = params.From || "";
    const toNumber = params.To || "";
    
    if (recordingUrl && recordingDuration > 0) {
      const supabase = createAdminClient();
      
      // Look up business from phone number
      const { data: phoneRecord } = await supabase
        .from("phone_numbers")
        .select("business_id")
        .eq("number", toNumber)
        .eq("is_active", true)
        .single() as { data: { business_id: string } | null };
      
      if (phoneRecord?.business_id) {
        const businessId = phoneRecord.business_id;
        
        // Create a call record with the voicemail
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
        const { data: callRecord, error: _callError } = await (supabase as any)
          .from("calls")
          .insert({
            business_id: businessId,
            from_number: fromNumber,
            to_number: toNumber,
            started_at: new Date().toISOString(),
            ended_at: new Date().toISOString(),
            duration_seconds: recordingDuration,
            duration_minutes_billed: Math.ceil(recordingDuration / 60),
            recording_url: recordingUrl,
            outcome: "message",
            summary: "Voicemail left via fallback IVR",
          })
          .select()
          .single();
        
        
        // Check notification settings and send SMS alert if enabled
        const { data: notificationSettings } = await supabase
          .from("notification_settings")
          .select("sms_messages")
          .eq("business_id", businessId)
          .single() as { data: { sms_messages: boolean } | null };
        
        if (notificationSettings?.sms_messages) {
          // Get owner's phone number
          const { data: business } = await supabase
            .from("businesses")
            .select("user_id")
            .eq("id", businessId)
            .single() as { data: { user_id: string } | null };
          
          if (business?.user_id) {
            const { data: user } = await supabase
              .from("users")
              .select("phone")
              .eq("id", business.user_id)
              .single() as { data: { phone: string | null } | null };
            
            if (user?.phone) {
              await sendMessageAlert({
                to: user.phone,
                from: toNumber,
                callerPhone: fromNumber,
                message: `New voicemail (${recordingDuration} seconds)`,
              });
              
              // Record the SMS in database
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
              await (supabase as any)
                .from("sms_messages")
                .insert({
                  business_id: businessId,
                  call_id: callRecord?.id,
                  direction: "outbound",
                  message_type: "message_alert",
                  from_number: toNumber,
                  to_number: user.phone,
                  body: `Voicemail from ${formatPhoneDisplay(fromNumber)}`,
                  status: "sent",
                });
            }
          }
        }
      }
    }
    
    // Thank the caller
    return twimlResponse(generateRecordingComplete());
    
  } catch (_error) {
    return twimlResponse(simpleSay(
      "Thank you for your message. Goodbye."
    ));
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
