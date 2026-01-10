/**
 * Dashboard Home Page
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 7, Lines 666-677
 */

import { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Manage your Koya AI receptionist. View calls, appointments, and analytics.",
};
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import {
  getCallStats,
  getMinutesUsage,
  getRecentCalls,
  getCallTrends,
  getUpcomingAppointmentsForWidget,
  getAIPerformance,
  getWeeklyComparison,
} from "@/lib/db/calls";
import { redirect } from "next/navigation";
import {
  MinutesUsageWidget,
  StatsCards,
  OutcomeBreakdown,
  RecentCallsList,
  CallTrends,
  UpcomingAppointments,
  QuickActions,
  AIPerformance,
  WeeklyComparison,
} from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";

// Prevent static prerendering - requires auth
export const dynamic = "force-dynamic";

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Skeleton className="h-40 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

async function DashboardContent() {
  // Get authenticated user
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // Get user's business
  const business = await getBusinessByUserId(user.id);
  if (!business) {
    redirect("/onboarding");
  }

  // Fetch all dashboard data in parallel
  const [
    callStats,
    minutesUsage,
    recentCalls,
    callTrends,
    upcomingAppointments,
    aiPerformance,
    weeklyComparison,
  ] = await Promise.all([
    getCallStats(business.id),
    getMinutesUsage(business.id),
    getRecentCalls(business.id, 10),
    getCallTrends(business.id),
    getUpcomingAppointmentsForWidget(business.id, 5),
    getAIPerformance(business.id),
    getWeeklyComparison(business.id),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s an overview of your Koya activity.
        </p>
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Minutes Usage - Spec Lines 594-651 */}
      <MinutesUsageWidget
        used={minutesUsage.used}
        included={minutesUsage.included}
        percentage={minutesUsage.percentage}
        estimatedCalls={minutesUsage.estimatedCalls}
        daysUntilReset={minutesUsage.daysUntilReset}
        colorLevel={minutesUsage.colorLevel}
      />

      {/* Stats Cards - Spec Lines 671-674 */}
      <StatsCards
        todayCalls={callStats.todayCalls}
        weekCalls={callStats.weekCalls}
        todayAppointments={callStats.todayAppointments}
        weekAppointments={callStats.weekAppointments}
      />

      {/* Call Trends Chart */}
      <CallTrends data={callTrends} />

      {/* Two column layout for outcomes and recent calls */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Outcome Breakdown - Spec Line 674 */}
        <OutcomeBreakdown outcomes={callStats.outcomeBreakdown} />

        {/* Recent Calls - Spec Line 675 */}
        <RecentCallsList calls={recentCalls} />
      </div>

      {/* Three column layout for smaller widgets */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Upcoming Appointments */}
        <UpcomingAppointments appointments={upcomingAppointments} />

        {/* AI Performance Metrics */}
        <AIPerformance
          bookingRate={aiPerformance.bookingRate}
          avgCallDuration={aiPerformance.avgCallDuration}
          successRate={aiPerformance.successRate}
          totalCallsHandled={aiPerformance.totalCallsHandled}
        />

        {/* Weekly Comparison */}
        <WeeklyComparison
          thisWeekCalls={weeklyComparison.thisWeekCalls}
          lastWeekCalls={weeklyComparison.lastWeekCalls}
          thisWeekAppointments={weeklyComparison.thisWeekAppointments}
          lastWeekAppointments={weeklyComparison.lastWeekAppointments}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
