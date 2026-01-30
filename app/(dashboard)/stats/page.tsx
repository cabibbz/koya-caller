/**
 * Stats Page - Data-Dense Dashboard
 * Compact, information-rich analytics view
 */

import { Metadata } from "next"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { getBusinessByUserId } from "@/lib/db/core"
import {
  getCallStats,
  getMinutesUsage,
  getRecentCalls,
  getCallTrends,
  getUpcomingAppointmentsForWidget,
  getSentimentBreakdown,
  getLanguageBreakdown,
  getPeakHours,
  getMissedCallRate,
  getCallsHandled,
} from "@/lib/db/calls"
import { redirect } from "next/navigation"
import { StatsDashboard } from "./stats-dashboard"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Stats",
  description: "Detailed analytics and statistics for your Koya AI receptionist",
}

export const dynamic = "force-dynamic"

function LoadingSkeleton() {
  return (
    <div className="space-y-2 p-2">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-6 gap-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-lg" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  )
}

async function StatsContent() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  const business = await getBusinessByUserId(user.id)
  if (!business) {
    redirect("/onboarding")
  }

  const [
    callStats,
    minutesUsage,
    recentCalls,
    callTrends,
    upcomingAppointments,
    sentimentBreakdown,
    languageBreakdown,
    peakHours,
    missedCallRate,
    callsHandled,
  ] = await Promise.all([
    getCallStats(business.id),
    getMinutesUsage(business.id),
    getRecentCalls(business.id, 10),
    getCallTrends(business.id),
    getUpcomingAppointmentsForWidget(business.id, 5),
    getSentimentBreakdown(business.id),
    getLanguageBreakdown(business.id),
    getPeakHours(business.id),
    getMissedCallRate(business.id),
    getCallsHandled(business.id),
  ])

  // Check if Spanish is enabled for this business
  // Type assertion needed for Supabase RLS type inference limitations
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: aiConfig } = await (await createClient())
    .from("ai_config")
    .select("spanish_enabled")
    .eq("business_id", business.id)
    .single()

  const spanishEnabled = ((aiConfig as any)?.spanish_enabled as boolean) || false
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <StatsDashboard
      callStats={callStats}
      minutesUsage={minutesUsage}
      recentCalls={recentCalls}
      callTrends={callTrends}
      upcomingAppointments={upcomingAppointments}
      sentimentBreakdown={sentimentBreakdown}
      languageBreakdown={languageBreakdown}
      peakHours={peakHours}
      missedCallRate={missedCallRate}
      callsHandled={callsHandled}
      spanishEnabled={spanishEnabled}
    />
  )
}

export default function StatsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <StatsContent />
    </Suspense>
  )
}
