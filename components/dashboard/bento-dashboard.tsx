"use client"

import { useState, useCallback } from "react"
import { Phone, Calendar, TrendingUp, Clock, CheckCircle, ArrowUpRight, Zap, Wifi, WifiOff, Loader2 } from "lucide-react"
import { AnimatedCounter, AnimatedPercent, AnimatedDuration } from "@/components/dashboard/demos/shared/animated-counter"
import { StaggerContainer, StaggerItem } from "@/components/dashboard/demos/shared/motion-wrapper"
import { AreaChart } from "@/components/dashboard/demos/shared/charts/area-chart"
import { DonutChart } from "@/components/dashboard/demos/shared/charts/donut-chart"
import { motion, AnimatePresence } from "framer-motion"
import { formatDistanceToNow, format } from "date-fns"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
import { SetupChecklist, type ChecklistData } from "@/components/dashboard/setup-checklist"
import {
  DateRangePicker,
  type DateRangeValue,
  type DateRangePreset,
  dateRangeToParams,
  getDateRangeFromPreset,
} from "@/components/ui/date-range-picker"
import { useRealtimeCalls } from "@/hooks/use-realtime-calls"
import { useRealtimeAppointments } from "@/hooks/use-realtime-appointments"
import { toast } from "@/hooks/use-toast"
import type { Call, Appointment } from "@/types"

// Type for recent calls from server (simplified)
type RecentCallData = {
  id: string
  from_number: string | null
  duration_seconds: number | null
  outcome: string | null
  language: string
  created_at: string
}

// Type for upcoming appointments from server (simplified)
type UpcomingAppointmentData = {
  id: string
  customerName: string
  serviceName: string
  scheduledAt: string
  status?: string
}

interface BentoDashboardProps {
  callStats: {
    todayCalls: number
    weekCalls: number
    todayAppointments: number
    weekAppointments: number
    totalCalls?: number
    totalAppointments?: number
    outcomeBreakdown: {
      booked: number
      transferred: number
      info: number
      message: number
      missed: number
      minutes_exhausted: number
    }
  }
  minutesUsage: {
    used: number
    included: number
    percentage: number
    estimatedCalls: number
    daysUntilReset: number
    colorLevel: string
  }
  recentCalls: RecentCallData[]
  callTrends: Array<{
    date: string
    dayLabel: string
    count: number
  }>
  upcomingAppointments: UpcomingAppointmentData[]
  aiPerformance: {
    bookingRate: number
    avgCallDuration: number
    successRate: number
    totalCallsHandled: number
  }
  weeklyComparison: {
    thisWeekCalls: number
    lastWeekCalls: number
    thisWeekAppointments: number
    lastWeekAppointments: number
    periodLabel?: string
  }
  checklistData?: ChecklistData
  businessId?: string
  dateRangePreset?: DateRangePreset
  dateRange?: {
    from: Date
    to: Date
  }
  /** Enable realtime updates (requires businessId) */
  enableRealtime?: boolean
}

function BentoCell({ children, className = "", span = "col-span-1" }: {
  children: React.ReactNode
  className?: string
  span?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.3 }}
      className={`
        ${span}
        bg-gradient-to-br from-zinc-900 to-zinc-900/80
        border border-zinc-800/50
        rounded-3xl p-6
        hover:border-zinc-700/50 hover:shadow-xl hover:shadow-black/20
        transition-all duration-300
        ${className}
      `}
    >
      {children}
    </motion.div>
  )
}

export function BentoDashboard({
  callStats,
  minutesUsage,
  recentCalls,
  callTrends,
  upcomingAppointments,
  aiPerformance,
  weeklyComparison,
  checklistData,
  businessId,
  dateRangePreset = "30d",
  dateRange,
}: BentoDashboardProps) {
  const router = useRouter()
  const pathname = usePathname()

  // Initialize date range value from props
  const currentDateRange: DateRangeValue = {
    preset: dateRangePreset,
    from: dateRange?.from ?? getDateRangeFromPreset(dateRangePreset).from,
    to: dateRange?.to ?? getDateRangeFromPreset(dateRangePreset).to,
  }

  // Handle date range change - update URL
  const handleDateRangeChange = (value: DateRangeValue) => {
    const params = dateRangeToParams(value)
    router.push(`${pathname}?${params.toString()}`)
  }

  // Get display label for selected range
  const getDateRangeLabel = () => {
    if (dateRangePreset === "custom" && dateRange) {
      return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`
    }
    const labels: Record<DateRangePreset, string> = {
      today: "Today",
      "7d": "Last 7 days",
      "30d": "Last 30 days",
      this_month: "This Month",
      custom: "Custom",
    }
    return labels[dateRangePreset]
  }

  const chartData = callTrends.map(d => ({
    name: d.dayLabel,
    value: d.count
  }))

  const outcomeData = [
    { name: "Booked", value: callStats.outcomeBreakdown.booked, color: "#10B981" },
    { name: "Transferred", value: callStats.outcomeBreakdown.transferred, color: "#3B82F6" },
    { name: "Info", value: callStats.outcomeBreakdown.info, color: "#8B5CF6" },
    { name: "Message", value: callStats.outcomeBreakdown.message, color: "#F59E0B" },
    { name: "Missed", value: callStats.outcomeBreakdown.missed, color: "#EF4444" },
  ].filter(d => d.value > 0)

  const totalOutcomes = outcomeData.reduce((sum, d) => sum + d.value, 0)

  const formatPhone = (phone: string | null) => {
    if (!phone) return "Unknown"
    const cleaned = phone.replace(/\D/g, "")
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  const outcomeColors: Record<string, string> = {
    booked: "bg-emerald-500",
    transferred: "bg-blue-500",
    info: "bg-purple-500",
    message: "bg-amber-500",
    missed: "bg-red-500",
    minutes_exhausted: "bg-gray-500",
  }

  // Calculate checklist completion to determine if we should show it
  const checklistCompletion = checklistData ? (() => {
    const items = [
      !!checklistData.businessName?.trim(),
      checklistData.phoneNumber,
      checklistData.businessHours,
      checklistData.servicesCount >= 1,
      checklistData.faqsCount >= 3,
      checklistData.voiceId !== null && checklistData.voiceId !== "default",
      checklistData.calendarConnected,
      checklistData.hasTestCall,
    ]
    return Math.round((items.filter(Boolean).length / items.length) * 100)
  })() : 100

  const showChecklist = checklistData && businessId && checklistCompletion < 100

  return (
    <StaggerContainer className="p-2">
      {/* Header with Date Range Picker */}
      <StaggerItem className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-zinc-500 mt-1">
              {dateRangePreset === "today"
                ? "Today's overview"
                : `${getDateRangeLabel()} overview`}
            </p>
          </div>
          <DateRangePicker
            value={currentDateRange}
            onChange={handleDateRangeChange}
            className="w-full sm:w-auto"
          />
        </div>
      </StaggerItem>

      {/* Setup Checklist - Show at top if incomplete */}
      {showChecklist && (
        <StaggerItem className="mb-6">
          <SetupChecklist data={checklistData} businessId={businessId} />
        </StaggerItem>
      )}

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[140px]">

        {/* Hero Stat - Large */}
        <BentoCell span="col-span-1 md:col-span-2 row-span-2" className="flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">{getDateRangeLabel()} Performance</span>
            </div>
            <p className="text-6xl font-bold tracking-tight">
              <AnimatedCounter value={callStats.totalCalls ?? callStats.weekCalls} />
            </p>
            <p className="text-zinc-500 mt-1">
              {dateRangePreset === "today" ? "calls today" : `calls in ${getDateRangeLabel().toLowerCase()}`}
            </p>
          </div>
          <div className="mt-4">
            <AreaChart data={chartData} height={120} showAxis={false} showGrid={false} />
          </div>
        </BentoCell>

        {/* Small Stats */}
        <BentoCell className="flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <Phone className="w-5 h-5 text-blue-400" />
            <span className="text-xs text-zinc-500">Today</span>
          </div>
          <div>
            <p className="text-4xl font-bold">
              <AnimatedCounter value={callStats.todayCalls} />
            </p>
            <p className="text-sm text-zinc-500">calls</p>
          </div>
        </BentoCell>

        <BentoCell className="flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <Calendar className="w-5 h-5 text-purple-400" />
            <span className="text-xs text-zinc-500">Today</span>
          </div>
          <div>
            <p className="text-4xl font-bold">
              <AnimatedCounter value={callStats.todayAppointments} />
            </p>
            <p className="text-sm text-zinc-500">booked</p>
          </div>
        </BentoCell>

        <BentoCell className="flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-xs text-zinc-500">Rate</span>
          </div>
          <div>
            <p className="text-4xl font-bold">
              <AnimatedPercent value={aiPerformance.successRate} />
            </p>
            <p className="text-sm text-zinc-500">success</p>
          </div>
        </BentoCell>

        <BentoCell className="flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <Clock className="w-5 h-5 text-amber-400" />
            <span className="text-xs text-zinc-500">Average</span>
          </div>
          <div>
            <p className="text-4xl font-bold">
              <AnimatedDuration seconds={aiPerformance.avgCallDuration} />
            </p>
            <p className="text-sm text-zinc-500">duration</p>
          </div>
        </BentoCell>

        {/* Minutes Usage - Wide */}
        <BentoCell span="col-span-1 md:col-span-2" className="flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              <span className="text-sm text-zinc-400">Minutes Usage</span>
            </div>
            <span className="text-sm text-zinc-500">{minutesUsage.daysUntilReset}d left</span>
          </div>
          <div className="flex items-end justify-between mt-4">
            <div>
              <p className="text-3xl font-bold">
                <AnimatedCounter value={minutesUsage.used} />
                <span className="text-zinc-500 text-lg"> / {minutesUsage.included}</span>
              </p>
            </div>
            <p className="text-2xl font-bold text-cyan-400">
              <AnimatedPercent value={minutesUsage.percentage} />
            </p>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full mt-4 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(minutesUsage.percentage, 100)}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
            />
          </div>
        </BentoCell>

        {/* Outcomes Donut */}
        <BentoCell span="col-span-1 md:col-span-2 row-span-2" className="flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Call Outcomes</h3>
            <span className="text-sm text-zinc-500">{totalOutcomes} total</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-6">
            <DonutChart
              data={outcomeData}
              size={160}
              innerRadius={50}
              outerRadius={70}
              centerValue={totalOutcomes}
            />
            <div className="space-y-2">
              {outcomeData.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${outcomeColors[item.name.toLowerCase()] || "bg-zinc-500"}`} />
                  <span className="text-sm text-zinc-400">{item.name}</span>
                  <span className="text-sm font-medium ml-auto">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </BentoCell>

        {/* Recent Calls - Tall */}
        <BentoCell span="col-span-1 md:col-span-2 row-span-2" className="flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Calls</h3>
            <Link href="/calls" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
              View all <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex-1 space-y-2 overflow-hidden">
            {recentCalls.slice(0, 5).map((call) => (
              <motion.div
                key={call.id}
                whileHover={{ x: 4 }}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${outcomeColors[call.outcome ?? "missed"] || "bg-zinc-500"}`} />
                  <div>
                    <p className="font-medium text-sm">{formatPhone(call.from_number)}</p>
                    <p className="text-xs text-zinc-500" suppressHydrationWarning>
                      {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-zinc-400">
                  {Math.floor((call.duration_seconds ?? 0) / 60)}:{((call.duration_seconds ?? 0) % 60).toString().padStart(2, "0")}
                </span>
              </motion.div>
            ))}
          </div>
        </BentoCell>

        {/* Weekly Comparison */}
        <BentoCell span="col-span-1 md:col-span-2" className="flex flex-col justify-between">
          <h3 className="font-semibold mb-2">{weeklyComparison.periodLabel || "This Week vs Last"}</h3>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-500">Calls</span>
                <span className={`text-xs ${weeklyComparison.thisWeekCalls >= weeklyComparison.lastWeekCalls ? "text-emerald-400" : "text-red-400"}`}>
                  {weeklyComparison.thisWeekCalls >= weeklyComparison.lastWeekCalls ? "↑" : "↓"}
                </span>
              </div>
              <div className="flex gap-2 text-sm">
                <span className="font-bold"><AnimatedCounter value={weeklyComparison.thisWeekCalls} /></span>
                <span className="text-zinc-500">vs {weeklyComparison.lastWeekCalls}</span>
              </div>
            </div>
            <div className="w-px bg-zinc-800" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-500">Appointments</span>
                <span className={`text-xs ${weeklyComparison.thisWeekAppointments >= weeklyComparison.lastWeekAppointments ? "text-emerald-400" : "text-red-400"}`}>
                  {weeklyComparison.thisWeekAppointments >= weeklyComparison.lastWeekAppointments ? "↑" : "↓"}
                </span>
              </div>
              <div className="flex gap-2 text-sm">
                <span className="font-bold"><AnimatedCounter value={weeklyComparison.thisWeekAppointments} /></span>
                <span className="text-zinc-500">vs {weeklyComparison.lastWeekAppointments}</span>
              </div>
            </div>
          </div>
        </BentoCell>

        {/* Upcoming Appointments */}
        <BentoCell span="col-span-1 md:col-span-2" className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Upcoming</h3>
            <Link href="/appointments" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
              All <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex-1 flex gap-2 overflow-x-auto">
            {upcomingAppointments.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
                No upcoming appointments
              </div>
            ) : (
              upcomingAppointments.slice(0, 3).map((apt) => (
                <motion.div
                  key={apt.id}
                  whileHover={{ scale: 1.02 }}
                  className="flex-shrink-0 w-36 p-3 rounded-xl bg-zinc-800/30 border border-zinc-700/30"
                >
                  <p className="text-xs text-zinc-500">{apt.serviceName}</p>
                  <p className="font-medium text-sm truncate mt-1">{apt.customerName}</p>
                  <p className="text-xs text-purple-400 mt-2">
                    {new Date(apt.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                </motion.div>
              ))
            )}
          </div>
        </BentoCell>

      </div>
    </StaggerContainer>
  )
}
