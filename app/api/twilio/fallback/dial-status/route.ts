/**
 * Koya Caller - TwiML Dial Status Handler
 * Session 12: Full Twilio Integration
 * 
 * Handles status of dial/transfer attempts
 * - If call connected: hang up
 * - If call failed: offer voicemail
 */

import { NextRequest, NextResponse } from "next/server";
import { generateDialStatusResponse, simpleSay } from "@/lib/twilio/twiml";
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

/**
 * POST /api/twilio/fallback/dial-status
 * Handle status of transfer attempt
 */
export async function POST(request: NextRequest) {
  try {
    const params = await parseTwilioParams(request);
    
    const dialCallStatus = params.DialCallStatus || "failed";
    const _dialCallDuration = parseInt(params.DialCallDuration || "0", 10);
    
    // Generate appropriate response
    const twiml = generateDialStatusResponse({
      dialCallStatus,
      appUrl,
    });
    
    return twimlResponse(twiml);
    
  } catch (_error) {
    return twimlResponse(simpleSay(
      "We apologize for the technical difficulty. Goodbye."
    ));
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
