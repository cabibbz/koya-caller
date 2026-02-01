/**
 * Dashboard Stats API Route
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 7, Lines 666-677
 *
 * GET /api/dashboard/stats
 * Query params: ?range=7d or ?from=2025-01-01&to=2025-01-21
 * Returns: Minutes usage, call counts, appointment counts, outcome breakdown
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import {
  getCallStats,
  getMinutesUsage,
  getCallTrends,
  getAIPerformance,
  getWeeklyComparison,
  type DateRangeFilter,
} from "@/lib/db/calls";
import { logError } from "@/lib/logging";
import { subDays, startOfMonth, startOfDay, endOfDay, format } from "date-fns";

export const dynamic = "force-dynamic";

/**
 * Parse date range from query params
 * Supports preset ranges (today, 7d, 30d, this_month) or custom from/to dates
 */
function parseDateRange(searchParams: URLSearchParams): DateRangeFilter {
  const range = searchParams.get("range");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const now = new Date();
  const today = startOfDay(now);
  const endOfToday = endOfDay(now);

  // Custom date range takes priority
  if (fromParam && toParam) {
    return {
      from: new Date(fromParam).toISOString(),
      to: endOfDay(new Date(toParam)).toISOString(),
    };
  }

  // Preset ranges
  switch (range) {
    case "today":
      return {
        from: today.toISOString(),
        to: endOfToday.toISOString(),
      };
    case "7d":
      return {
        from: subDays(today, 6).toISOString(),
        to: endOfToday.toISOString(),
      };
    case "this_month":
      return {
        from: startOfMonth(today).toISOString(),
        to: endOfToday.toISOString(),
      };
    case "30d":
    default:
      return {
        from: subDays(today, 29).toISOString(),
        to: endOfToday.toISOString(),
      };
  }
}

async function handleGet(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    // Parse date range from query params
    const dateRange = parseDateRange(request.nextUrl.searchParams);

    // Fetch all dashboard stats in parallel with date range
    const [callStats, minutesUsage, callTrends, aiPerformance, weeklyComparison] = await Promise.all([
      getCallStats(business.id, dateRange),
      getMinutesUsage(business.id),
      getCallTrends(business.id, dateRange),
      getAIPerformance(business.id, dateRange),
      getWeeklyComparison(business.id, dateRange),
    ]);

    return success({
      dateRange: {
        from: format(new Date(dateRange.from), "yyyy-MM-dd"),
        to: format(new Date(dateRange.to), "yyyy-MM-dd"),
      },
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
        total: callStats.totalCalls,
      },
      appointments: {
        today: callStats.todayAppointments,
        week: callStats.weekAppointments,
        total: callStats.totalAppointments,
      },
      outcomes: callStats.outcomeBreakdown,
      trends: callTrends,
      aiPerformance: {
        bookingRate: aiPerformance.bookingRate,
        avgCallDuration: aiPerformance.avgCallDuration,
        successRate: aiPerformance.successRate,
        totalCallsHandled: aiPerformance.totalCallsHandled,
      },
      comparison: {
        thisWeekCalls: weeklyComparison.thisWeekCalls,
        lastWeekCalls: weeklyComparison.lastWeekCalls,
        thisWeekAppointments: weeklyComparison.thisWeekAppointments,
        lastWeekAppointments: weeklyComparison.lastWeekAppointments,
        periodLabel: weeklyComparison.periodLabel,
      },
      // Spec Line 676: Quick health check
      healthStatus: "active",
    });
  } catch (error) {
    logError("Dashboard Stats GET", error);
    return errors.internalError("Failed to fetch dashboard stats");
  }
}

// Apply auth middleware with rate limiting: 60 req/min per user (Spec Part 20)
export const GET = withAuth(handleGet);
