"use client"

import { Phone, Calendar, Clock, Zap, CheckCircle, PhoneIncoming, PhoneMissed, Smile, Meh, Frown, Globe } from "lucide-react"
import { AnimatedCounter, AnimatedPercent } from "@/components/dashboard/demos/shared/animated-counter"
import { StaggerContainer, StaggerItem } from "@/components/dashboard/demos/shared/motion-wrapper"
import { BarChart } from "@/components/dashboard/demos/shared/charts/bar-chart"
import { motion } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

interface StatsDashboardProps {
  callStats: {
    todayCalls: number
    weekCalls: number
    todayAppointments: number
    weekAppointments: number
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
  recentCalls: Array<{
    id: string
    from_number: string | null
    to_number: string | null
    direction: string | null
    duration_seconds: number | null
    outcome: string | null
    language: string
    created_at: string
  }>
  callTrends: Array<{
    date: string
    dayLabel: string
    count: number
  }>
  upcomingAppointments: Array<{
    id: string
    customerName: string
    serviceName: string
    scheduledAt: string
  }>
  sentimentBreakdown: {
    positive: number
    neutral: number
    negative: number
    total: number
  }
  languageBreakdown: {
    english: number
    spanish: number
    total: number
  }
  peakHours: Array<{
    hour: number
    count: number
    label: string
  }>
  missedCallRate: {
    missed: number
    total: number
    rate: number
  }
  callsHandled: {
    thisMonth: number
    lastMonth: number
  }
  spanishEnabled: boolean
}

function StatCard({ label, value, sublabel, icon: Icon, color = "text-white" }: {
  label: string
  value: React.ReactNode
  sublabel?: string
  icon?: React.ElementType
  color?: string
}) {
  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className={`w-4 h-4 ${color}`} />}
        <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sublabel && <p className="text-xs text-zinc-500 mt-1">{sublabel}</p>}
    </div>
  )
}

export function StatsDashboard({
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
  spanishEnabled,
}: StatsDashboardProps) {
  // Format phone number
  const formatPhone = (phone: string | null) => {
    if (!phone) return "Unknown"
    const cleaned = phone.replace(/\D/g, "")
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    return phone
  }

  // Get the caller/recipient phone number based on call direction
  // For inbound calls: show from_number (who called)
  // For outbound calls: show to_number (who was called)
  const getCallerNumber = (call: { from_number: string | null; to_number: string | null; direction: string | null }) => {
    if (call.direction === "outbound") {
      return call.to_number
    }
    // For inbound or unknown direction, prefer from_number
    return call.from_number
  }

  // Calculate booking rate based on total calls handled this month
  const bookingRate = callsHandled.thisMonth > 0
    ? Math.round((callStats.outcomeBreakdown.booked / callsHandled.thisMonth) * 100)
    : 0

  // Total outcomes for percentage calculations in the outcome breakdown UI
  const totalOutcomes = Object.values(callStats.outcomeBreakdown).reduce((a, b) => a + b, 0)

  // Get peak hour
  const peakHour = peakHours.reduce((max, h) => h.count > max.count ? h : max, peakHours[0])

  // Outcome badge styles
  const getOutcomeBadge = (outcome: string | null) => {
    const styles: Record<string, string> = {
      booked: "text-emerald-400 bg-emerald-500/20",
      transferred: "text-blue-400 bg-blue-500/20",
      info: "text-purple-400 bg-purple-500/20",
      message: "text-amber-400 bg-amber-500/20",
      missed: "text-red-400 bg-red-500/20",
      minutes_exhausted: "text-zinc-400 bg-zinc-500/20",
    }
    return styles[outcome ?? ""] || "text-zinc-400 bg-zinc-500/20"
  }

  const formatOutcome = (outcome: string | null) => {
    const labels: Record<string, string> = {
      booked: "Booked",
      transferred: "Transfer",
      info: "Info",
      message: "Message",
      missed: "Missed",
      minutes_exhausted: "Exhausted",
    }
    return labels[outcome ?? ""] || "Unknown"
  }

  // Prepare chart data for 7-day trend
  const trendChartData = callTrends.map(d => ({
    name: d.dayLabel,
    value: d.count
  }))

  // Prepare peak hours chart (business hours only: 8am-8pm)
  const businessHours = peakHours.filter(h => h.hour >= 8 && h.hour <= 20)
  const peakHoursChartData = businessHours.map(h => ({
    name: h.label,
    value: h.count
  }))

  // Outcome colors for the breakdown
  const outcomes = [
    { key: "booked", label: "Booked", value: callStats.outcomeBreakdown.booked, color: "bg-emerald-500" },
    { key: "transferred", label: "Transferred", value: callStats.outcomeBreakdown.transferred, color: "bg-blue-500" },
    { key: "info", label: "Info", value: callStats.outcomeBreakdown.info, color: "bg-purple-500" },
    { key: "message", label: "Message", value: callStats.outcomeBreakdown.message, color: "bg-amber-500" },
    { key: "missed", label: "Missed", value: callStats.outcomeBreakdown.missed, color: "bg-red-500" },
  ]

  return (
    <StaggerContainer className="space-y-4 p-4">
      {/* Header */}
      <StaggerItem>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-sm text-zinc-500">This month&apos;s performance</p>
          </div>
        </div>
      </StaggerItem>

      {/* Key Metrics Row */}
      <StaggerItem>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Calls Handled"
            value={<AnimatedCounter value={callsHandled.thisMonth} />}
            sublabel={`${callsHandled.lastMonth} last month`}
            icon={PhoneIncoming}
            color="text-blue-400"
          />
          <StatCard
            label="Booking Rate"
            value={<AnimatedPercent value={bookingRate} />}
            sublabel={`${callStats.outcomeBreakdown.booked} bookings`}
            icon={CheckCircle}
            color="text-emerald-400"
          />
          <StatCard
            label="Missed Rate"
            value={<AnimatedPercent value={missedCallRate.rate} />}
            sublabel={`${missedCallRate.missed} of ${missedCallRate.total} calls`}
            icon={PhoneMissed}
            color={missedCallRate.rate > 10 ? "text-red-400" : "text-zinc-400"}
          />
          <StatCard
            label="Peak Hour"
            value={peakHour?.label || "N/A"}
            sublabel={peakHour ? `${peakHour.count} calls` : "No data"}
            icon={Clock}
            color="text-amber-400"
          />
        </div>
      </StaggerItem>

      {/* Minutes Usage */}
      <StaggerItem>
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span className="font-medium">Minutes Usage</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="font-mono">
                <AnimatedCounter value={minutesUsage.used} /> / {minutesUsage.included}
              </span>
              <span className={`font-bold ${
                minutesUsage.percentage > 90 ? "text-red-400" :
                minutesUsage.percentage > 75 ? "text-amber-400" :
                "text-cyan-400"
              }`}>
                <AnimatedPercent value={minutesUsage.percentage} />
              </span>
            </div>
          </div>
          <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(minutesUsage.percentage, 100)}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full rounded-full ${
                minutesUsage.percentage > 90 ? "bg-red-500" :
                minutesUsage.percentage > 75 ? "bg-amber-500" :
                "bg-cyan-500"
              }`}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-2">{minutesUsage.daysUntilReset} days until reset</p>
        </div>
      </StaggerItem>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 7-Day Call Volume */}
        <StaggerItem>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-medium">7-Day Call Volume</span>
              <span className="text-xs text-zinc-500">
                Total: <AnimatedCounter value={callTrends.reduce((sum, d) => sum + d.count, 0)} />
              </span>
            </div>
            <BarChart data={trendChartData} height={140} showGrid={false} barSize={32} />
          </div>
        </StaggerItem>

        {/* Peak Hours */}
        <StaggerItem>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-medium">Peak Hours</span>
              <span className="text-xs text-zinc-500">Last 30 days, 8am-8pm</span>
            </div>
            <BarChart data={peakHoursChartData} height={140} showGrid={false} barSize={20} />
          </div>
        </StaggerItem>
      </div>

      {/* Sentiment & Language Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Caller Sentiment */}
        <StaggerItem>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <Smile className="w-4 h-4 text-emerald-400" />
              <span className="font-medium">Caller Sentiment</span>
              <span className="text-xs text-zinc-500 ml-auto">This month</span>
            </div>
            {sentimentBreakdown.total === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-4">No sentiment data yet</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smile className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm">Positive</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-emerald-400">{sentimentBreakdown.positive}</span>
                    <span className="text-xs text-zinc-500">
                      ({Math.round((sentimentBreakdown.positive / sentimentBreakdown.total) * 100)}%)
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Meh className="w-4 h-4 text-zinc-400" />
                    <span className="text-sm">Neutral</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{sentimentBreakdown.neutral}</span>
                    <span className="text-xs text-zinc-500">
                      ({Math.round((sentimentBreakdown.neutral / sentimentBreakdown.total) * 100)}%)
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Frown className="w-4 h-4 text-red-400" />
                    <span className="text-sm">Negative</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-red-400">{sentimentBreakdown.negative}</span>
                    <span className="text-xs text-zinc-500">
                      ({Math.round((sentimentBreakdown.negative / sentimentBreakdown.total) * 100)}%)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </StaggerItem>

        {/* Language Breakdown - Only show if Spanish enabled */}
        {spanishEnabled ? (
          <StaggerItem>
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-blue-400" />
                <span className="font-medium">Language Split</span>
                <span className="text-xs text-zinc-500 ml-auto">This month</span>
              </div>
              {languageBreakdown.total === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">No calls yet</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">English</span>
                      <span className="text-sm font-medium">{languageBreakdown.english} calls</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(languageBreakdown.english / languageBreakdown.total) * 100}%` }}
                        className="h-full bg-blue-500 rounded-full"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Spanish</span>
                      <span className="text-sm font-medium">{languageBreakdown.spanish} calls</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(languageBreakdown.spanish / languageBreakdown.total) * 100}%` }}
                        className="h-full bg-amber-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </StaggerItem>
        ) : (
          /* Outcome Breakdown if no Spanish */
          <StaggerItem>
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="font-medium">Call Outcomes</span>
              </div>
              <div className="space-y-2">
                {outcomes.map((item) => {
                  const pct = totalOutcomes > 0 ? Math.round((item.value / totalOutcomes) * 100) : 0
                  return (
                    <div key={item.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${item.color}`} />
                        <span className="text-sm text-zinc-400">{item.label}</span>
                      </div>
                      <span className="text-sm font-medium">{item.value} <span className="text-zinc-500">({pct}%)</span></span>
                    </div>
                  )
                })}
              </div>
            </div>
          </StaggerItem>
        )}
      </div>

      {/* Bottom Row: Recent Calls & Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Calls */}
        <StaggerItem>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-400" />
                <span className="font-medium">Recent Calls</span>
              </div>
              <Link href="/calls" className="text-xs text-blue-400 hover:text-blue-300">
                View All →
              </Link>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {recentCalls.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-8">No calls yet</p>
              ) : (
                recentCalls.slice(0, 5).map((call) => (
                  <Link
                    key={call.id}
                    href={`/calls?id=${call.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition-colors"
                  >
                    <div>
                      <span className="font-medium text-sm">{formatPhone(getCallerNumber(call))}</span>
                      <p className="text-xs text-zinc-500" suppressHydrationWarning>
                        {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400 font-mono">
                        {Math.floor((call.duration_seconds ?? 0) / 60)}:{((call.duration_seconds ?? 0) % 60).toString().padStart(2, "0")}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${getOutcomeBadge(call.outcome)}`}>
                        {formatOutcome(call.outcome)}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </StaggerItem>

        {/* Upcoming Appointments */}
        <StaggerItem>
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span className="font-medium">Upcoming Appointments</span>
              </div>
              <Link href="/appointments" className="text-xs text-purple-400 hover:text-purple-300">
                View All →
              </Link>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {upcomingAppointments.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-8">No upcoming appointments</p>
              ) : (
                upcomingAppointments.slice(0, 5).map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <span className="font-medium text-sm">{apt.customerName}</span>
                      <p className="text-xs text-zinc-500">{apt.serviceName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-purple-400">
                        {new Date(apt.scheduledAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {new Date(apt.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </StaggerItem>
      </div>
    </StaggerContainer>
  )
}
