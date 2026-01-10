/**
 * Call Detail API Route
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 7, Lines 687-692
 * 
 * GET /api/dashboard/calls/[id]
 * Returns: Full call details including transcript, recording, appointment
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { getCallById, getAppointmentByCallId } from "@/lib/db/calls";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's business
    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 }
      );
    }

    // Get the call
    const call = await getCallById(id);
    if (!call) {
      return NextResponse.json(
        { error: "Call not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    if (call.business_id !== business.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // Get related appointment if any
    const appointment = await getAppointmentByCallId(id);

    return NextResponse.json({
      success: true,
      data: {
        call,
        appointment,
      },
    });
  } catch (error) {
    console.error("[Call Detail API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch call details" },
      { status: 500 }
    );
  }
}
