/**
 * Outbound Call Initiation API Route
 * POST /api/outbound/initiate
 *
 * Initiates an immediate outbound call via Retell.
 * Validates business ownership, DNC list, and outbound hours.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { initiateOutboundCall, checkDNC, isWithinOutboundHours, checkDailyLimit } from "@/lib/outbound";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { logError, logInfo } from "@/lib/logging";
import { toE164, isValidE164 } from "@/lib/utils/phone";

export const dynamic = "force-dynamic";

// =============================================================================
// Types
// =============================================================================

interface InitiateCallRequest {
  to_number: string;
  from_number?: string; // Optional, will use business default if not provided
  purpose: "reminder" | "followup" | "custom";
  custom_message?: string;
  appointment_id?: string;
  metadata?: Record<string, string>;
}

// =============================================================================
// POST Handler
// =============================================================================

async function handlePost(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's business
    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Parse request body
    const body: InitiateCallRequest = await request.json();

    // Validate required fields
    if (!body.to_number) {
      return NextResponse.json(
        { error: "to_number is required" },
        { status: 400 }
      );
    }

    if (!body.purpose || !["reminder", "followup", "custom"].includes(body.purpose)) {
      return NextResponse.json(
        { error: "purpose must be one of: reminder, followup, custom" },
        { status: 400 }
      );
    }

    // Normalize and validate phone number
    const toNumber = toE164(body.to_number);
    if (!toNumber || !isValidE164(toNumber)) {
      return NextResponse.json(
        { error: "Invalid phone number format. Use E.164 format (+1XXXXXXXXXX)" },
        { status: 400 }
      );
    }

    // If from_number is provided, validate that business owns it
    if (body.from_number) {
      const { data: phoneNumber } = await supabase
        .from("phone_numbers")
        .select("id")
        .eq("business_id", business.id)
        .eq("number", body.from_number)
        .eq("is_active", true)
        .single();

      if (!phoneNumber) {
        return NextResponse.json(
          { error: "from_number is not a valid phone number for this business" },
          { status: 400 }
        );
      }
    }

    // Check if outbound is enabled for this business
    const { data: settings } = await (supabase as any)
      .from("outbound_settings")
      .select("outbound_enabled")
      .eq("business_id", business.id)
      .single() as { data: { outbound_enabled: boolean } | null };

    if (!settings?.outbound_enabled) {
      return NextResponse.json(
        { error: "Outbound calling is not enabled for this business" },
        { status: 403 }
      );
    }

    // Check DNC list
    const isDNC = await checkDNC(business.id, toNumber);
    if (isDNC) {
      return NextResponse.json(
        {
          error: "Number is on the Do-Not-Call list",
          reason: "dnc",
        },
        { status: 400 }
      );
    }

    // Check outbound hours
    const withinHours = await isWithinOutboundHours(business.id);
    if (!withinHours) {
      return NextResponse.json(
        {
          error: "Outside of configured outbound calling hours",
          reason: "outside_hours",
        },
        { status: 400 }
      );
    }

    // Check daily limit
    const limitCheck = await checkDailyLimit(business.id);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Daily outbound call limit of ${limitCheck.limit} has been reached`,
          reason: "daily_limit",
          used: limitCheck.used,
          limit: limitCheck.limit,
        },
        { status: 429 }
      );
    }

    // Initiate the call
    const result = await initiateOutboundCall(business.id, toNumber, {
      purpose: body.purpose,
      customMessage: body.custom_message,
      appointmentId: body.appointment_id,
      metadata: body.metadata,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Failed to initiate call",
          reason: result.reason,
        },
        { status: 500 }
      );
    }

    logInfo(
      "Outbound Initiate",
      `Call initiated to ${toNumber} for business ${business.id}`
    );

    return NextResponse.json({
      success: true,
      data: {
        call_id: result.callId,
        retell_call_id: result.retellCallId,
        to_number: toNumber,
        purpose: body.purpose,
        status: "initiated",
      },
    });
  } catch (error) {
    logError("Outbound Initiate", error);
    return NextResponse.json(
      { error: "Failed to initiate outbound call" },
      { status: 500 }
    );
  }
}

// Apply rate limiting: 60 req/min per user
export const POST = withDashboardRateLimit(handlePost);
