/**
 * Koya Caller - TwiML Fallback Handler
 * Session 12: Full Twilio Integration
 * 
 * Spec Reference: Part 12, Lines 1573-1594
 * 
 * This route handles incoming calls when Retell is unavailable.
 * Provides a basic IVR that:
 * - Plays a greeting
 * - Offers to take a message or connect to backup number
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import twilio from "twilio";
import {
  generateFallbackGreeting,
  simpleSay,
} from "@/lib/twilio/twiml";
import { logError } from "@/lib/logging";
import { getAppUrl } from "@/lib/config";

const appUrl = getAppUrl();
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

// Verify Twilio webhook signature
function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null
): boolean {
  if (!TWILIO_AUTH_TOKEN || !signature) return false;
  return twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, url, params);
}

// Helper to parse Twilio form data
async function _parseTwilioParams(request: NextRequest): Promise<Record<string, string>> {
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

// Get business info from phone number
async function getBusinessFromNumber(toNumber: string) {
  const supabase = createAdminClient();
  
  // Look up phone number
  const { data: phoneRecord, error: phoneError } = await supabase
    .from("phone_numbers")
    .select("business_id")
    .eq("number", toNumber)
    .eq("is_active", true)
    .single() as { data: { business_id: string } | null; error: any };
  
  if (phoneError || !phoneRecord?.business_id) {
    return null;
  }
  
  const businessId = phoneRecord.business_id;
  
  // Get business details
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .single() as { data: { id: string; name: string } | null };
  
  // Get call settings
  const { data: callSettings } = await supabase
    .from("call_settings")
    .select("transfer_number, backup_transfer_number")
    .eq("business_id", businessId)
    .single() as { data: { transfer_number: string | null; backup_transfer_number: string | null } | null };
  
  return {
    businessId,
    businessName: business?.name || "our business",
    transferNumber: callSettings?.transfer_number || null,
    backupNumber: callSettings?.backup_transfer_number || null,
  };
}

/**
 * Main fallback handler - called when voice URL fails
 * POST /api/twilio/fallback
 */
export async function POST(request: NextRequest) {
  try {
    // Clone request to read body twice (once for verification, once for parsing)
    const clonedRequest = request.clone();
    const rawBody = await clonedRequest.text();
    const formData = new URLSearchParams(rawBody);
    const params: Record<string, string> = {};
    formData.forEach((value, key) => {
      params[key] = value;
    });

    // Verify Twilio signature - required unless explicitly bypassed for local testing
    const allowBypass = process.env.WEBHOOK_SIGNATURE_BYPASS === "true" &&
                        process.env.NODE_ENV !== "production";

    if (TWILIO_AUTH_TOKEN && !allowBypass) {
      const signature = request.headers.get("x-twilio-signature");
      const webhookUrl = `${appUrl}/api/twilio/fallback`;

      if (!verifyTwilioSignature(webhookUrl, params, signature)) {
        logError("Twilio Fallback", "Invalid signature");
        return new Response("Unauthorized", { status: 401 });
      }
    }

    const toNumber = params.To || "";
    const _callSid = params.CallSid || "";
    const _reason = params.ErrorCode ? `error:${params.ErrorCode}` : "fallback";
    
    // Get business info
    const business = await getBusinessFromNumber(toNumber);
    
    if (!business) {
      // Unknown number - play generic message
      return twimlResponse(simpleSay(
        "Thank you for calling. We are unable to process your call at this time. Please try again later."
      ));
    }
    
    // Generate fallback greeting with menu
    const twiml = generateFallbackGreeting({
      businessName: business.businessName,
      hasBackupNumber: !!(business.transferNumber || business.backupNumber),
      appUrl,
    });
    
    return twimlResponse(twiml);
    
  } catch (_error) {
    return twimlResponse(simpleSay(
      "We apologize, but we are experiencing technical difficulties. Please try your call again later."
    ));
  }
}

// Prevent other HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
