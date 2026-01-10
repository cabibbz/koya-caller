/**
 * Dashboard Calls API Route
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 7, Lines 678-699
 * 
 * GET /api/dashboard/calls
 * Query params: startDate, endDate, outcome, language, search, limit, offset
 * Returns: Paginated list of calls with filters
 * 
 * PATCH /api/dashboard/calls
 * Body: { id, flagged?, notes? }
 * Returns: Updated call
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { 
  getCallsByBusinessId, 
  getRecentCalls, 
  updateCall,
  getAppointmentByCallId 
} from "@/lib/db/calls";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import type { CallOutcome, CallLanguage } from "@/types";

export const dynamic = "force-dynamic";

async function handleGet(request: NextRequest) {
  try {
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const outcome = searchParams.get("outcome") as CallOutcome | undefined;
    const language = searchParams.get("language") as CallLanguage | undefined;
    const searchQuery = searchParams.get("search") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const recent = searchParams.get("recent") === "true";

    // If recent flag is set, return just recent calls for dashboard
    if (recent) {
      const recentCalls = await getRecentCalls(business.id, 10);
      return NextResponse.json({
        success: true,
        data: {
          calls: recentCalls,
          total: recentCalls.length,
          hasMore: false,
        },
      });
    }

    // Get filtered calls
    const { calls, total } = await getCallsByBusinessId(business.id, {
      startDate,
      endDate,
      outcome,
      language,
      searchQuery,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: {
        calls,
        total,
        limit,
        offset,
        hasMore: offset + calls.length < total,
      },
    });
  } catch (error) {
    console.error("[Dashboard Calls API] GET Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch calls" },
      { status: 500 }
    );
  }
}

async function handlePatch(request: NextRequest) {
  try {
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

    // Parse request body
    const body = await request.json();
    const { id, flagged, notes } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Call ID is required" },
        { status: 400 }
      );
    }

    // Verify call belongs to user's business before updating
    const { data: existingCall, error: callError } = await supabase
      .from("calls")
      .select("id, business_id")
      .eq("id", id)
      .single<{ id: string; business_id: string }>();

    if (callError || !existingCall) {
      return NextResponse.json(
        { error: "Call not found" },
        { status: 404 }
      );
    }

    if (existingCall.business_id !== business.id) {
      return NextResponse.json(
        { error: "Not authorized to update this call" },
        { status: 403 }
      );
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (typeof flagged === "boolean") {
      updates.flagged = flagged;
    }
    if (typeof notes === "string") {
      updates.notes = notes;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    // Update the call
    const updatedCall = await updateCall(id, updates as any);

    if (!updatedCall) {
      return NextResponse.json(
        { error: "Failed to update call - no data returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedCall,
    });
  } catch (error) {
    console.error("[Dashboard Calls API] PATCH Error:", error);
    return NextResponse.json(
      { error: "Failed to update call" },
      { status: 500 }
    );
  }
}

// Apply rate limiting: 60 req/min per user (Spec Part 20)
export const GET = withDashboardRateLimit(handleGet);
export const PATCH = withDashboardRateLimit(handlePatch);
