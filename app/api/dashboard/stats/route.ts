/**
 * Dashboard Stats API Route
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 7, Lines 666-677
 * 
 * GET /api/dashboard/stats
 * Returns: Minutes usage, call counts, appointment counts, outcome breakdown
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { getCallStats, getMinutesUsage } from "@/lib/db/calls";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";

export const dynamic = "force-dynamic";

async function handler(request: NextRequest) {
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

    // Fetch all dashboard stats in parallel
    const [callStats, minutesUsage] = await Promise.all([
      getCallStats(business.id),
      getMinutesUsage(business.id),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        minutes: {
          used: minutesUsage.used,
          included: minutesUsage.included,
          percentage: minutesUsage.percentage,
          estimatedCalls: minutesUsage.estimatedCalls,
          daysUntilReset: minutesUsage.daysUntilReset,
          colorLevel: minutesUsage.colorLevel,
        },
        calls: {
          today: callStats.todayCalls,
          week: callStats.weekCalls,
        },
        appointments: {
          today: callStats.todayAppointments,
          week: callStats.weekAppointments,
        },
        outcomes: callStats.outcomeBreakdown,
        // Spec Line 676: Quick health check
        healthStatus: "active",
      },
    });
  } catch (error) {
    console.error("[Dashboard Stats API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}

// Apply rate limiting: 60 req/min per user (Spec Part 20)
export const GET = withDashboardRateLimit(handler);
