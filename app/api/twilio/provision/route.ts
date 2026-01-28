/**
 * Koya Caller - Twilio Phone Number Provisioning API
 * Session 12: Full Twilio Integration
 * Session 23: Enhanced Error Handling
 *
 * Spec Reference: Part 12, Lines 1548-1557
 *
 * Provisions (purchases) a phone number from Twilio and stores in database.
 * Cost: $1.00/month per number
 *
 * Features:
 * - Retry logic for transient Twilio failures
 * - Error logging to system_logs table
 * - Detailed error messages for user feedback
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { provisionPhoneNumber, isTwilioConfigured, formatPhoneDisplay } from "@/lib/twilio";
import {
  handleTwilioProvisioningFailure,
  withRetry,
  isTwilioRetryable,
} from "@/lib/errors";
import { getAppUrl } from "@/lib/config";

const appUrl = getAppUrl();

interface ProvisionRequest {
  phoneNumber: string;
  businessId: string;
  setupType?: "direct" | "forwarded";
  forwardedFrom?: string;
  carrier?: string;
}

export async function POST(request: NextRequest) {
  let requestBody: ProvisionRequest | undefined;

  try {
    const body: ProvisionRequest = await request.json();
    requestBody = body;
    const { phoneNumber, businessId, setupType = "direct", forwardedFrom, carrier } = body;

    // Validate input
    if (!phoneNumber) {
      return NextResponse.json(
        { error: "Invalid request", message: "Phone number is required" },
        { status: 400 }
      );
    }

    if (!businessId) {
      return NextResponse.json(
        { error: "Invalid request", message: "Business ID is required" },
        { status: 400 }
      );
    }

    // Validate phone number format (E.164)
    if (!/^\+1\d{10}$/.test(phoneNumber)) {
      return NextResponse.json(
        { error: "Invalid format", message: "Phone number must be in E.164 format" },
        { status: 400 }
      );
    }

    // Provision the number via Twilio (or mock)
    // Voice goes to main Twilio webhook which checks business hours, minutes, etc.
    // then routes to Retell for AI handling
    // Uses retry logic for transient Twilio failures
    const result = await withRetry(
      () =>
        provisionPhoneNumber({
          phoneNumber,
          voiceUrl: `${appUrl}/api/twilio/webhook`,
          voiceFallbackUrl: `${appUrl}/api/twilio/fallback`,
          smsUrl: `${appUrl}/api/twilio/sms`,
          friendlyName: `Koya - ${businessId}`,
        }),
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        retryIf: isTwilioRetryable,
      }
    );

    // Store in database using admin client (bypasses RLS)
    const supabase = createAdminClient();

    // First, deactivate any existing active numbers for this business
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { error: _deactivateError } = await (supabase as any)
      .from("phone_numbers")
      .update({ is_active: false })
      .eq("business_id", businessId)
      .eq("is_active", true);

    // Don't fail the request if deactivation fails

    // Insert the new phone number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: phoneRecord, error: insertError } = await (supabase as any)
      .from("phone_numbers")
      .insert({
        business_id: businessId,
        number: phoneNumber,
        twilio_sid: result.sid,
        setup_type: setupType,
        forwarded_from: forwardedFrom || null,
        carrier: carrier || null,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      // Note: Number is already provisioned in Twilio at this point
      // We should still return success
      return NextResponse.json({
        success: true,
        sid: result.sid,
        phoneNumber: result.phoneNumber,
        warning: "Number provisioned but database storage failed",
      });
    }

    return NextResponse.json({
      success: true,
      sid: result.sid,
      phoneNumber: result.phoneNumber,
      phoneNumberId: phoneRecord.id,
      friendlyName: formatPhoneDisplay(result.phoneNumber),
      mock: !isTwilioConfigured(),
    });

  } catch (error) {
    // Log to system_logs for admin visibility
    await handleTwilioProvisioningFailure(error, {
      businessId: requestBody?.businessId,
      phoneNumber: requestBody?.phoneNumber,
      action: "provision_phone_number",
    });

    // Check for specific Twilio errors
    if (error instanceof Error) {
      if (error.message.includes("authenticate")) {
        return NextResponse.json(
          { error: "Configuration error", message: "Twilio credentials are invalid" },
          { status: 500 }
        );
      }

      if (error.message.includes("not available")) {
        return NextResponse.json(
          { error: "Number unavailable", message: "This number is no longer available. Please select a different number." },
          { status: 400 }
        );
      }

      if (error.message.includes("rate limit") || error.message.includes("429")) {
        return NextResponse.json(
          { error: "Rate limited", message: "Too many requests. Please try again in a few minutes." },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: "Provision failed", message: "Unable to provision phone number. Please try again." },
      { status: 500 }
    );
  }
}
