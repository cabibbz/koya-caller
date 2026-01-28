"use client";

/**
 * Minutes Usage Widget
 * Session 16: Dashboard - Home & Calls
 * Spec Reference: Part 6, Lines 594-651
 *
 * Shows:
 * - Progress bar with color coding
 * - Minutes used / included
 * - Estimated calls equivalent
 * - Days until reset
 * - Upgrade prompt if >80% used
 * - Minutes exhausted warning if 100%
 */

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ArrowUpRight, Clock } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface MinutesUsageProps {
  used: number;
  included: number;
  percentage: number;
  estimatedCalls: number;
  daysUntilReset: number;
  colorLevel: "green" | "yellow" | "orange" | "red";
}

// Color mappings per Spec Line 669
const colorMap = {
  green: {
    bar: "bg-emerald-500",
    text: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  yellow: {
    bar: "bg-yellow-500",
    text: "text-yellow-500",
    bg: "bg-yellow-500/10",
  },
  orange: {
    bar: "bg-orange-500",
    text: "text-orange-500",
    bg: "bg-orange-500/10",
  },
  red: {
    bar: "bg-red-500",
    text: "text-red-500",
    bg: "bg-red-500/10",
  },
};

export function MinutesUsageWidget({
  used,
  included,
  percentage,
  estimatedCalls,
  daysUntilReset,
  colorLevel,
}: MinutesUsageProps) {
  const t = useTranslations("dashboard");
  const colors = colorMap[colorLevel];
  const isExhausted = percentage >= 100;
  const showUpgradePrompt = percentage >= 80;
  const maxCalls = Math.round(included / 5); // 5 min avg per call

  // Spec Lines 638-651: Minutes exhausted warning
  if (isExhausted) {
    return (
      <Card className="border-red-500/50 bg-red-500/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <CardTitle className="text-red-500">{t("minutesExhausted")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("messageOnlyMode")}
            <br />
            {t("cannotBookUntilUpgrade")}
          </p>
          <Link href="/settings/billing">
            <Button className="w-full gap-2 bg-red-500 hover:bg-red-600">
              {t("upgradeNowRestore")}
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground text-center">
            {t("minutesResetOrUpgrade", { days: daysUntilReset })}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("minutesThisMonth")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar - Spec Lines 596-606 */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{used}</span>
              <span className="text-muted-foreground">{t("minutesUsedOf", { total: included })}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", colors.bar)}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {t("callsEstimate", { used: estimatedCalls, total: maxCalls })}
            </span>
            <div className="flex items-center gap-1.5">
              <span className={cn("font-medium", colors.text)}>
                {t("percentUsed", { percent: percentage })}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {t("resetsIn", { days: daysUntilReset })}
              </span>
            </div>
          </div>
        </div>

        {/* Upgrade prompt - Spec Lines 604, 670 */}
        {showUpgradePrompt && (
          <div className={cn("rounded-lg p-3", colors.bg)}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("runningLow")}</span>
              <Link href="/settings/billing">
                <Button variant="ghost" size="sm" className="gap-1 h-8">
                  {t("upgradeToProfessional")}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
