"use client";

/**
 * Call Outcome Breakdown
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 7, Line 674
 * 
 * Shows: booked, transferred, info only, message taken breakdown
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { 
  CalendarCheck, 
  PhoneForwarded, 
  Info, 
  MessageSquare,
  PhoneMissed,
  Clock
} from "lucide-react";

interface OutcomeBreakdownProps {
  outcomes: Record<string, number>;
}

const outcomeConfig = {
  booked: {
    labelKey: "outcomeBooked",
    icon: CalendarCheck,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  transferred: {
    labelKey: "outcomeTransferred",
    icon: PhoneForwarded,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  info: {
    labelKey: "outcomeInfoOnly",
    icon: Info,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  message: {
    labelKey: "outcomeMessageTaken",
    icon: MessageSquare,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  missed: {
    labelKey: "outcomeMissed",
    icon: PhoneMissed,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  minutes_exhausted: {
    labelKey: "outcomeOverLimit",
    icon: Clock,
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
  },
};

export function OutcomeBreakdown({ outcomes }: OutcomeBreakdownProps) {
  const t = useTranslations("dashboard");
  const total = Object.values(outcomes).reduce((a, b) => a + b, 0);

  // Filter to only show outcomes with counts > 0 or the main 4
  const displayOutcomes = ["booked", "transferred", "info", "message"];
  const activeOutcomes = Object.entries(outcomes)
    .filter(([key, count]) => displayOutcomes.includes(key) || count > 0)
    .sort((a, b) => {
      // Sort by display order, then by count
      const aIndex = displayOutcomes.indexOf(a[0]);
      const bIndex = displayOutcomes.indexOf(b[0]);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return b[1] - a[1];
    });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("callOutcomesThisMonth")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">{t("noCallsYetThisMonth")}</p>
            <p className="text-xs mt-1">{t("outcomesWillAppear")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeOutcomes.map(([key, count]) => {
              const config = outcomeConfig[key as keyof typeof outcomeConfig];
              if (!config) return null;

              const Icon = config.icon;
              const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

              return (
                <div key={key} className="flex items-center gap-3">
                  <div className={cn("rounded-lg p-2", config.bgColor)}>
                    <Icon className={cn("h-4 w-4", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{t(config.labelKey)}</span>
                      <span className="text-sm text-muted-foreground">
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", config.color.replace("text-", "bg-"))}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
