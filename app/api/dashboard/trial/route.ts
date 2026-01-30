/**
 * Trial Status API Route
 *
 * GET /api/dashboard/trial
 * Returns trial status including days remaining, minutes used/limit
 *
 * Used by the TrialBanner component to display trial information
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";

export const dynamic = "force-dynamic";

export interface TrialStatus {
  isTrialing: boolean;
  trialEndsAt: string | null;
  daysRemaining: number;
  minutesUsed: number;
  minutesLimit: number;
  minutesRemaining: number;
  isExpired: boolean;
  isMinutesExhausted: boolean;
  showWarning: boolean; // true when < 3 days remaining
  subscriptionStatus: string;
}

async function handleGet(
  _request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    // Calculate trial status
    const now = new Date();
    const trialEndsAt = business.trial_ends_at ? new Date(business.trial_ends_at) : null;
    const isTrialing = business.subscription_status === "trialing";
    const isExpired = trialEndsAt ? trialEndsAt < now : false;

    // Calculate days remaining
    let daysRemaining = 0;
    if (trialEndsAt && !isExpired) {
      const diffMs = trialEndsAt.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    const minutesUsed = business.trial_minutes_used ?? 0;
    const minutesLimit = business.trial_minutes_limit ?? 30;
    const minutesRemaining = Math.max(0, minutesLimit - minutesUsed);
    const isMinutesExhausted = minutesUsed >= minutesLimit;

    // Show warning when less than 3 days remaining or minutes nearly exhausted
    const showWarning = isTrialing && (daysRemaining <= 3 || minutesRemaining <= 5);

    const trialStatus: TrialStatus = {
      isTrialing,
      trialEndsAt: trialEndsAt?.toISOString() ?? null,
      daysRemaining,
      minutesUsed,
      minutesLimit,
      minutesRemaining,
      isExpired,
      isMinutesExhausted,
      showWarning,
      subscriptionStatus: business.subscription_status ?? "unknown",
    };

    return success(trialStatus);
  } catch (_error) {
    return errors.internalError("Failed to fetch trial status");
  }
}

export const GET = withAuth(handleGet);
