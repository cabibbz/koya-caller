/**
 * Koya Caller - TwiML Fallback Menu Handler
 * Session 12: Full Twilio Integration
 * 
 * Handles menu selection from fallback IVR
 * - Press 1: Leave a message
 * - Press 2: Connect to someone
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  generateFallbackMenuResponse,
  simpleSay,
} from "@/lib/twilio/twiml";
import { getAppUrl } from "@/lib/config";

const appUrl = getAppUrl();

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

// Get backup number for a phone
async function getBackupNumber(toNumber: string): Promise<string | null> {
  const supabase = createAdminClient();
  
  // Look up phone number
  const { data: phoneRecord } = await supabase
    .from("phone_numbers")
    .select("business_id")
    .eq("number", toNumber)
    .eq("is_active", true)
    .single() as { data: { business_id: string } | null };
  
  if (!phoneRecord?.business_id) return null;
  
  // Get call settings
  const { data: callSettings } = await supabase
    .from("call_settings")
    .select("transfer_number, backup_transfer_number")
    .eq("business_id", phoneRecord.business_id)
    .single() as { data: { transfer_number: string | null; backup_transfer_number: string | null } | null };
  
  return callSettings?.transfer_number || callSettings?.backup_transfer_number || null;
}

/**
 * POST /api/twilio/fallback/menu
 * Handle DTMF input from fallback menu
 */
export async function POST(request: NextRequest) {
  try {
    const params = await parseTwilioParams(request);
    const digits = params.Digits || "";
    const toNumber = params.To || "";
    
    // Get backup number if needed
    let backupNumber: string | undefined;
    if (digits === "2") {
      backupNumber = (await getBackupNumber(toNumber)) || undefined;
    }
    
    // Generate response based on selection
    const twiml = generateFallbackMenuResponse({
      digit: digits,
      backupNumber,
      appUrl,
    });
    
    return twimlResponse(twiml);
    
  } catch (_error) {
    return twimlResponse(simpleSay(
      "We apologize for the technical difficulty. Please try your call again later."
    ));
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
