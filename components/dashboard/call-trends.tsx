"use client";

/**
 * Call Trends Chart
 * Shows call volume over the last 7 days
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface DayData {
  date: string;
  dayLabel: string;
  calls: number;
}

interface CallTrendsProps {
  data: DayData[];
}

function calculateTrend(data: DayData[]): { trend: "up" | "down" | "flat"; percentage: number } {
  if (data.length < 4) return { trend: "flat", percentage: 0 };

  // Compare last 3 days vs first 4 days
  const firstHalf = data.slice(0, 4).reduce((sum, d) => sum + d.calls, 0);
  const secondHalf = data.slice(4).reduce((sum, d) => sum + d.calls, 0);

  if (firstHalf === 0) {
    return { trend: secondHalf > 0 ? "up" : "flat", percentage: secondHalf > 0 ? 100 : 0 };
  }

  const change = ((secondHalf - firstHalf) / firstHalf) * 100;
  return {
    trend: change > 5 ? "up" : change < -5 ? "down" : "flat",
    percentage: Math.abs(Math.round(change)),
  };
}

export function CallTrends({ data }: CallTrendsProps) {
  const t = useTranslations("dashboard");
  const { trend, percentage: trendPercentage } = calculateTrend(data);
  const maxCalls = Math.max(...data.map((d) => d.calls), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">{t("callTrends")}</CardTitle>
          <div
            className={cn(
              "flex items-center gap-1 text-sm font-medium",
              trend === "up" && "text-emerald-500",
              trend === "down" && "text-red-500",
              trend === "flat" && "text-muted-foreground"
            )}
          >
            {trend === "up" && <TrendingUp className="h-4 w-4" />}
            {trend === "down" && <TrendingDown className="h-4 w-4" />}
            {trend === "flat" && <Minus className="h-4 w-4" />}
            <span>
              {trend === "up" ? "+" : trend === "down" ? "-" : ""}
              {trendPercentage}%
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("last7Days")}</p>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-2 h-32">
          {data.map((day, index) => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center h-24">
                <div
                  className={cn(
                    "w-full max-w-8 rounded-t transition-all",
                    index === data.length - 1
                      ? "bg-primary"
                      : "bg-primary/30 hover:bg-primary/50"
                  )}
                  style={{
                    height: `${(day.calls / maxCalls) * 100}%`,
                    minHeight: day.calls > 0 ? "4px" : "0px",
                  }}
                  title={`${day.calls} ${t("calls")}`}
                />
              </div>
              <span className="text-xs text-muted-foreground">{day.dayLabel}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t flex justify-between text-sm">
          <span className="text-muted-foreground">{t("totalThisWeek")}</span>
          <span className="font-medium">
            {data.reduce((sum, d) => sum + d.calls, 0)} {t("calls")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
