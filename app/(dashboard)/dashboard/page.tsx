/**
 * Dashboard Home Page
 * Bento Grid Style Dashboard with Date Range Support
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
  getAIPerformance,
  getWeeklyComparison,
  type DateRangeFilter,
} from "@/lib/db/calls"
import { getBusinessHours, getServices } from "@/lib/db/core"
import {
  getActivePhoneNumber,
  getFAQsByBusinessId,
  getAIConfigByBusinessId,
  getCalendarIntegrationByBusinessId,
} from "@/lib/db/operations"
import type { ChecklistData } from "@/components/dashboard/setup-checklist"
import { redirect } from "next/navigation"
import { BentoDashboard } from "@/components/dashboard/bento-dashboard"
import { Skeleton } from "@/components/ui/skeleton"
import { subDays, startOfMonth, startOfDay, endOfDay } from "date-fns"
import type { DateRangePreset } from "@/components/ui/date-range-picker"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Manage your Koya AI receptionist. View calls, appointments, and analytics.",
}

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

/**
 * Parse date range from URL search params
 */
function parseDateRange(searchParams: { [key: string]: string | string[] | undefined }): {
  dateRange: DateRangeFilter
  preset: DateRangePreset
} {
  const range = searchParams.range as DateRangePreset | undefined
  const fromParam = searchParams.from as string | undefined
  const toParam = searchParams.to as string | undefined

  const now = new Date()
  const today = startOfDay(now)
  const endOfToday = endOfDay(now)

  // Custom date range takes priority
  if (range === "custom" && fromParam && toParam) {
    return {
      dateRange: {
        from: new Date(fromParam).toISOString(),
        to: endOfDay(new Date(toParam)).toISOString(),
      },
      preset: "custom",
    }
  }

  // Preset ranges
  switch (range) {
    case "today":
      return {
        dateRange: {
          from: today.toISOString(),
          to: endOfToday.toISOString(),
        },
        preset: "today",
      }
    case "7d":
      return {
        dateRange: {
          from: subDays(today, 6).toISOString(),
          to: endOfToday.toISOString(),
        },
        preset: "7d",
      }
    case "this_month":
      return {
        dateRange: {
          from: startOfMonth(today).toISOString(),
          to: endOfToday.toISOString(),
        },
        preset: "this_month",
      }
    case "30d":
    default:
      return {
        dateRange: {
          from: subDays(today, 29).toISOString(),
          to: endOfToday.toISOString(),
        },
        preset: "30d",
      }
  }
}

function LoadingSkeleton() {
  return (
    <div className="p-2">
      <Skeleton className="h-12 w-64 mb-6" />
      <div className="grid grid-cols-4 gap-4 auto-rows-[140px]">
        <Skeleton className="col-span-2 row-span-2 rounded-3xl" />
        <Skeleton className="rounded-3xl" />
        <Skeleton className="rounded-3xl" />
        <Skeleton className="rounded-3xl" />
        <Skeleton className="rounded-3xl" />
        <Skeleton className="col-span-2 rounded-3xl" />
        <Skeleton className="col-span-2 row-span-2 rounded-3xl" />
        <Skeleton className="col-span-2 row-span-2 rounded-3xl" />
        <Skeleton className="col-span-2 rounded-3xl" />
        <Skeleton className="col-span-2 rounded-3xl" />
      </div>
    </div>
  )
}

async function DashboardContent({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect("/login")
  }

  const business = await getBusinessByUserId(user.id)
  if (!business) {
    redirect("/onboarding")
  }

  // Parse date range from URL params
  const { dateRange, preset } = parseDateRange(searchParams)

  // Use Promise.allSettled to prevent dashboard crash if any query fails
  const results = await Promise.allSettled([
    getCallStats(business.id, dateRange),
    getMinutesUsage(business.id),
    getRecentCalls(business.id, 10),
    getCallTrends(business.id, dateRange),
    getUpcomingAppointmentsForWidget(business.id, 5),
    getAIPerformance(business.id, dateRange),
    getWeeklyComparison(business.id, dateRange),
    // Checklist data queries
    getBusinessHours(business.id),
    getServices(business.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getActivePhoneNumber(supabase as any, business.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getFAQsByBusinessId(supabase as any, business.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getAIConfigByBusinessId(supabase as any, business.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getCalendarIntegrationByBusinessId(supabase as any, business.id),
  ])

  // Extract values with defaults for failed queries
  const callStats = results[0].status === 'fulfilled' ? results[0].value : {
    todayCalls: 0,
    weekCalls: 0,
    todayAppointments: 0,
    weekAppointments: 0,
    totalCalls: 0,
    totalAppointments: 0,
    outcomeBreakdown: {
      booked: 0,
      transferred: 0,
      info: 0,
      message: 0,
      missed: 0,
      minutes_exhausted: 0,
    },
  }
  const minutesUsage = results[1].status === 'fulfilled' ? results[1].value : {
    used: 0,
    included: 200,
    percentage: 0,
    estimatedCalls: 0,
    daysUntilReset: 30,
    colorLevel: "green" as const,
  }
  const recentCalls = results[2].status === 'fulfilled' ? results[2].value : []
  const callTrends = results[3].status === 'fulfilled' ? results[3].value : []
  const upcomingAppointments = results[4].status === 'fulfilled' ? results[4].value : []
  const aiPerformance = results[5].status === 'fulfilled' ? results[5].value : {
    bookingRate: 0,
    avgCallDuration: 0,
    successRate: 0,
    totalCallsHandled: 0,
  }
  const weeklyComparison = results[6].status === 'fulfilled' ? results[6].value : {
    thisWeekCalls: 0,
    lastWeekCalls: 0,
    thisWeekAppointments: 0,
    lastWeekAppointments: 0,
    periodLabel: "This Week vs Last",
  }
  // Checklist data
  const businessHours = results[7].status === 'fulfilled' ? results[7].value : []
  const services = results[8].status === 'fulfilled' ? results[8].value : []
  const phoneNumber = results[9].status === 'fulfilled' ? results[9].value : null
  const faqs = results[10].status === 'fulfilled' ? results[10].value : []
  const aiConfig = results[11].status === 'fulfilled' ? results[11].value : null
  const calendarIntegration = results[12].status === 'fulfilled' ? results[12].value : null

  // Build checklist data
  const checklistData: ChecklistData = {
    businessName: business.name,
    phoneNumber: phoneNumber !== null && phoneNumber.is_active,
    businessHours: businessHours.some((h) => !h.is_closed),
    servicesCount: services.length,
    faqsCount: faqs.length,
    voiceId: aiConfig?.voice_id ?? null,
    calendarConnected:
      calendarIntegration !== null &&
      calendarIntegration.provider !== "built_in" &&
      calendarIntegration.access_token !== null,
    hasTestCall: recentCalls.length > 0,
  }

  return (
    <BentoDashboard
      callStats={callStats}
      minutesUsage={minutesUsage}
      recentCalls={recentCalls}
      callTrends={callTrends}
      upcomingAppointments={upcomingAppointments}
      aiPerformance={aiPerformance}
      weeklyComparison={weeklyComparison}
      checklistData={checklistData}
      businessId={business.id}
      dateRangePreset={preset}
      dateRange={{
        from: new Date(dateRange.from),
        to: new Date(dateRange.to),
      }}
    />
  )
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DashboardContent searchParams={resolvedSearchParams} />
    </Suspense>
  )
}
