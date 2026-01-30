"use client";

/**
 * Trial Banner Component
 *
 * Displays trial status information in the dashboard:
 * - Days remaining in trial
 * - Minutes used vs limit
 * - Warning state when < 3 days remaining
 * - Upgrade call-to-action button
 */

import { useState, useEffect } from "react";
import { Clock, Zap, AlertTriangle, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

interface TrialStatus {
  isTrialing: boolean;
  trialEndsAt: string | null;
  daysRemaining: number;
  minutesUsed: number;
  minutesLimit: number;
  minutesRemaining: number;
  isExpired: boolean;
  isMinutesExhausted: boolean;
  showWarning: boolean;
  subscriptionStatus: string;
}

export function TrialBanner() {
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed this session (only for non-critical states)
    const wasDismissed = sessionStorage.getItem("trial-banner-dismissed");
    if (wasDismissed) {
      // Still fetch to check if status changed to critical
      fetch("/api/dashboard/trial")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            const status = data.data as TrialStatus;
            // Only keep dismissed if not critical
            if (!status.isExpired && !status.isMinutesExhausted && status.daysRemaining > 1) {
              setDismissed(true);
            } else {
              setTrialStatus(status);
            }
          }
        })
        .catch(() => {
          setDismissed(true);
        })
        .finally(() => setLoading(false));
      return;
    }

    // Fetch trial status
    fetch("/api/dashboard/trial")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTrialStatus(data.data);
        }
      })
      .catch(() => {
        // Silently fail - don't show banner if we can't fetch status
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("trial-banner-dismissed", "true");
  };

  // Don't render if loading, dismissed, or not trialing
  if (loading || dismissed) {
    return null;
  }

  if (!trialStatus || !trialStatus.isTrialing) {
    // Check for expired trial - show upgrade prompt
    if (trialStatus?.subscriptionStatus === "trial_expired") {
      return <ExpiredTrialBanner />;
    }
    return null;
  }

  // Check if trial is expired or minutes exhausted - show critical banner
  if (trialStatus.isExpired || trialStatus.isMinutesExhausted) {
    return <ExpiredTrialBanner isMinutesExhausted={trialStatus.isMinutesExhausted} />;
  }

  const minutesPercentage = Math.min(
    100,
    (trialStatus.minutesUsed / trialStatus.minutesLimit) * 100
  );

  // Determine banner variant based on urgency
  const isUrgent = trialStatus.daysRemaining <= 3;
  const isCritical = trialStatus.daysRemaining <= 1 || trialStatus.minutesRemaining <= 5;

  return (
    <Alert
      className={`mb-4 ${
        isCritical
          ? "border-destructive/50 bg-destructive/10"
          : isUrgent
          ? "border-warning/50 bg-warning/10"
          : "border-primary/50 bg-primary/10"
      }`}
    >
      <div className="flex items-start gap-3">
        {isCritical ? (
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
        ) : isUrgent ? (
          <Clock className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
        ) : (
          <Zap className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <AlertDescription className="font-medium text-foreground">
              {isCritical ? (
                trialStatus.minutesRemaining <= 5 ? (
                  `Trial minutes almost used! Only ${trialStatus.minutesRemaining} min left`
                ) : (
                  "Trial expires tomorrow! Upgrade now to keep your AI receptionist active"
                )
              ) : isUrgent ? (
                `Trial ends in ${trialStatus.daysRemaining} days`
              ) : (
                `Free trial: ${trialStatus.daysRemaining} days remaining`
              )}
            </AlertDescription>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href="/settings?tab=billing">
                <Button
                  size="sm"
                  variant={isCritical ? "destructive" : isUrgent ? "default" : "outline"}
                  className="h-8"
                >
                  Upgrade Now
                </Button>
              </Link>
              {!isCritical && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                  onClick={handleDismiss}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Minutes usage progress bar */}
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {trialStatus.minutesUsed} / {trialStatus.minutesLimit} trial minutes used
              </span>
              <span>{Math.round(minutesPercentage)}%</span>
            </div>
            <Progress
              value={minutesPercentage}
              className={`h-2 ${
                minutesPercentage >= 90
                  ? "[&>div]:bg-destructive"
                  : minutesPercentage >= 70
                  ? "[&>div]:bg-warning"
                  : "[&>div]:bg-primary"
              }`}
            />
          </div>
        </div>
      </div>
    </Alert>
  );
}

/**
 * Banner shown when trial has expired or minutes are exhausted
 */
function ExpiredTrialBanner({ isMinutesExhausted = false }: { isMinutesExhausted?: boolean }) {
  return (
    <Alert className="mb-4 border-destructive/50 bg-destructive/10">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <AlertDescription className="font-semibold text-destructive">
                {isMinutesExhausted
                  ? "Trial minutes exhausted"
                  : "Your trial has expired"}
              </AlertDescription>
              <p className="text-sm text-muted-foreground mt-1">
                {isMinutesExhausted
                  ? "You've used all 30 trial minutes. Upgrade to continue using your AI receptionist."
                  : "Your 14-day free trial has ended. Upgrade now to keep your AI receptionist answering calls."}
              </p>
            </div>

            <Link href="/settings?tab=billing">
              <Button size="sm" variant="destructive" className="h-8">
                Upgrade Now
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Alert>
  );
}
