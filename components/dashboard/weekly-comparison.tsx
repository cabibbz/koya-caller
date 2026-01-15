"use client";

/**
 * Weekly Comparison Card
 * Compares this week vs last week stats
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Phone, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface WeeklyComparisonProps {
  thisWeekCalls: number;
  lastWeekCalls: number;
  thisWeekAppointments: number;
  lastWeekAppointments: number;
}

function calculateChange(current: number, previous: number): {
  percentage: number;
  trend: "up" | "down" | "flat";
} {
  if (previous === 0) {
    return {
      percentage: current > 0 ? 100 : 0,
      trend: current > 0 ? "up" : "flat",
    };
  }
  const change = ((current - previous) / previous) * 100;
  return {
    percentage: Math.abs(Math.round(change)),
    trend: change > 0 ? "up" : change < 0 ? "down" : "flat",
  };
}

export function WeeklyComparison({
  thisWeekCalls,
  lastWeekCalls,
  thisWeekAppointments,
  lastWeekAppointments,
}: WeeklyComparisonProps) {
  const callsChange = calculateChange(thisWeekCalls, lastWeekCalls);
  const appointmentsChange = calculateChange(thisWeekAppointments, lastWeekAppointments);

  const metrics = [
    {
      label: "Calls",
      thisWeek: thisWeekCalls,
      lastWeek: lastWeekCalls,
      change: callsChange,
      icon: Phone,
    },
    {
      label: "Appointments",
      thisWeek: thisWeekAppointments,
      lastWeek: lastWeekAppointments,
      change: appointmentsChange,
      icon: Calendar,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Weekly Comparison</CardTitle>
        <p className="text-xs text-muted-foreground">This week vs last week</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-muted">
                <metric.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{metric.label}</span>
                  <div
                    className={cn(
                      "flex items-center gap-1 text-sm font-medium",
                      metric.change.trend === "up" && "text-emerald-500",
                      metric.change.trend === "down" && "text-red-500",
                      metric.change.trend === "flat" && "text-muted-foreground"
                    )}
                  >
                    {metric.change.trend === "up" && (
                      <TrendingUp className="h-3 w-3" />
                    )}
                    {metric.change.trend === "down" && (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {metric.change.trend === "flat" && (
                      <Minus className="h-3 w-3" />
                    )}
                    <span>
                      {metric.change.trend !== "flat" && (
                        <>
                          {metric.change.trend === "up" ? "+" : "-"}
                          {metric.change.percentage}%
                        </>
                      )}
                      {metric.change.trend === "flat" && "No change"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                  <span>This week: {metric.thisWeek}</span>
                  <span>Last week: {metric.lastWeek}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
