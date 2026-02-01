/**
 * Twilio Number Configuration API
 * Configures an existing Twilio number's webhooks to point to our app
 * 
 * POST /api/twilio/configure
 * - Uses TWILIO_PHONE_NUMBER from environment
 * - Updates voice/SMS webhook URLs
 * - Associates number with business
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Check if Twilio is configured
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

interface ConfigureRequest {
  businessId: string;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ConfigureRequest = await request.json();
    const { businessId } = body;

    if (!businessId) {
      return NextResponse.json(
        { error: "Business ID is required. Please complete signup first." },
        { status: 400 }
      );
    }

    // Verify user owns this business
    const { data: business, error: bizError } = await supabase
      .from("businesses")
      .select("id, user_id")
      .eq("id", businessId)
      .single() as { data: { id: string; user_id: string | null } | null; error: unknown };

    if (bizError || !business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (business.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if we have an existing number configured
    if (!TWILIO_PHONE_NUMBER) {
      return NextResponse.json(
        {
          error: "No existing Twilio number configured",
          message: "Set TWILIO_PHONE_NUMBER in your .env.local file"
        },
        { status: 400 }
      );
    }

    // Validate E.164 format
    if (!TWILIO_PHONE_NUMBER.startsWith("+")) {
      return NextResponse.json(
        {
          error: "Invalid phone number format",
          message: "TWILIO_PHONE_NUMBER must be in E.164 format (e.g., +14074568607)"
        },
        { status: 400 }
      );
    }

    // If Twilio credentials aren't set, use mock mode
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      const { error: dbError } = await (supabase.from("businesses") as any)
        .update({
          phone_number: TWILIO_PHONE_NUMBER,
          twilio_phone_sid: "mock_existing_number",
        })
        .eq("id", businessId);

      if (dbError) {
        return NextResponse.json(
          { error: "Failed to save phone number" },
          { status: 500 }
        );
      }

      // Also save to phone_numbers table
      await (supabase.from("phone_numbers") as any)
        .update({ is_active: false })
        .eq("business_id", businessId);

      const { data: existingPhone } = await (supabase.from("phone_numbers") as any)
        .select("id")
        .eq("business_id", businessId)
        .eq("number", TWILIO_PHONE_NUMBER)
        .single();

      if (existingPhone) {
        await (supabase.from("phone_numbers") as any)
          .update({ twilio_sid: "mock_existing_number", is_active: true })
          .eq("id", existingPhone.id);
      } else {
        await (supabase.from("phone_numbers") as any)
          .insert({
            business_id: businessId,
            number: TWILIO_PHONE_NUMBER,
            twilio_sid: "mock_existing_number",
            setup_type: "direct",
            is_active: true,
          });
      }

      return NextResponse.json({
        success: true,
        phoneNumber: TWILIO_PHONE_NUMBER,
        sid: "mock_existing_number",
        configured: false,
        message: "Phone number saved (mock mode - webhooks not configured)",
      });
    }

    // Real Twilio configuration
    const twilio = await import("twilio");
    const client = twilio.default(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    // Find the phone number in Twilio account
    const incomingNumbers = await client.incomingPhoneNumbers.list({
      phoneNumber: TWILIO_PHONE_NUMBER,
      limit: 1,
    });

    if (incomingNumbers.length === 0) {
      return NextResponse.json(
        { 
          error: "Phone number not found in your Twilio account",
          message: `${TWILIO_PHONE_NUMBER} is not in your Twilio account. Check the number or provision a new one.`
        },
        { status: 404 }
      );
    }

    const phoneNumberResource = incomingNumbers[0];

    // Configure webhooks for voice and SMS
    const webhookUrl = `${SITE_URL}/api/twilio/webhook`;
    const fallbackUrl = `${SITE_URL}/api/twilio/fallback`;
    const statusCallbackUrl = `${SITE_URL}/api/twilio/status`;

    await client.incomingPhoneNumbers(phoneNumberResource.sid).update({
      voiceUrl: webhookUrl,
      voiceMethod: "POST",
      voiceFallbackUrl: fallbackUrl,
      voiceFallbackMethod: "POST",
      statusCallback: statusCallbackUrl,
      statusCallbackMethod: "POST",
      smsUrl: `${SITE_URL}/api/twilio/sms/incoming`,
      smsMethod: "POST",
    });

    // Save to businesses table
    const { error: dbError } = await (supabase.from("businesses") as any)
      .update({
        phone_number: TWILIO_PHONE_NUMBER,
        twilio_phone_sid: phoneNumberResource.sid,
      })
      .eq("id", businessId);

    if (dbError) {
      return NextResponse.json(
        { error: "Failed to save phone number to database" },
        { status: 500 }
      );
    }

    // Also save to phone_numbers table for consistency
    // First deactivate any existing numbers for this business
    await (supabase.from("phone_numbers") as any)
      .update({ is_active: false })
      .eq("business_id", businessId);

    // Check if this number already exists
    const { data: existingPhone } = await (supabase.from("phone_numbers") as any)
      .select("id")
      .eq("business_id", businessId)
      .eq("number", TWILIO_PHONE_NUMBER)
      .single();

    if (existingPhone) {
      // Update existing record
      await (supabase.from("phone_numbers") as any)
        .update({
          twilio_sid: phoneNumberResource.sid,
          is_active: true,
        })
        .eq("id", existingPhone.id);
    } else {
      // Insert new record
      await (supabase.from("phone_numbers") as any)
        .insert({
          business_id: businessId,
          number: TWILIO_PHONE_NUMBER,
          twilio_sid: phoneNumberResource.sid,
          setup_type: "direct",
          is_active: true,
        });
    }

    return NextResponse.json({
      success: true,
      phoneNumber: TWILIO_PHONE_NUMBER,
      sid: phoneNumberResource.sid,
      configured: true,
      webhooks: {
        voice: webhookUrl,
        fallback: fallbackUrl,
        status: statusCallbackUrl,
      },
      message: "Existing number configured successfully",
    });

  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to configure phone number" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/twilio/configure
 * Check if an existing number is configured in environment
 */
export async function GET() {
  const hasExistingNumber = !!TWILIO_PHONE_NUMBER;
  const hasCredentials = !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN);

  return NextResponse.json({
    hasExistingNumber,
    phoneNumber: hasExistingNumber ? TWILIO_PHONE_NUMBER : null,
    hasCredentials,
    canConfigure: hasExistingNumber && hasCredentials,
  });
}
