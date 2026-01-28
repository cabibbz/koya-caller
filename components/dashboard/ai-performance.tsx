"use client";

/**
 * AI Performance Widget
 * Shows Koya's performance metrics
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, TrendingUp, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface AIPerformanceProps {
  bookingRate: number; // Percentage of calls that resulted in bookings
  avgCallDuration: number; // Average call duration in seconds
  successRate: number; // Percentage of calls with positive outcomes
  totalCallsHandled: number; // Total calls this month
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function AIPerformance({
  bookingRate,
  avgCallDuration,
  successRate,
  totalCallsHandled,
}: AIPerformanceProps) {
  const t = useTranslations("dashboard");

  const metrics = [
    {
      labelKey: "bookingRate",
      value: `${bookingRate}%`,
      subtextKey: "callsThatBooked",
      icon: Calendar,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      labelKey: "avgDuration",
      value: formatDuration(avgCallDuration),
      subtextKey: "perCall",
      icon: Clock,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      labelKey: "successRate",
      value: `${successRate}%`,
      subtextKey: "positiveOutcomes",
      icon: CheckCircle,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      labelKey: "callsHandled",
      value: totalCallsHandled.toLocaleString(),
      subtextKey: "thisMonth",
      icon: TrendingUp,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{t("koyaPerformance")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("thisBillingCycle")}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {metrics.map((metric) => (
            <div
              key={metric.labelKey}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/30"
            >
              <div className={cn("p-2 rounded-lg", metric.bgColor)}>
                <metric.icon className={cn("h-4 w-4", metric.color)} />
              </div>
              <div>
                <p className="text-lg font-bold">{metric.value}</p>
                <p className="text-xs text-muted-foreground">{t(metric.labelKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
