/**
 * Trial Period Database Helpers
 *
 * Functions for managing trial status, enforcement, and upgrades
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface TrialStatus {
  isTrialing: boolean;
  isActive: boolean;
  isExpired: boolean;
  isMinutesExhausted: boolean;
  canMakeCalls: boolean;
  trialEndsAt: Date | null;
  daysRemaining: number;
  minutesUsed: number;
  minutesLimit: number;
  minutesRemaining: number;
  subscriptionStatus: string;
}

/**
 * Get comprehensive trial status for a business
 */
export async function getTrialStatus(businessId: string): Promise<TrialStatus> {
  const supabase = await createClient();

  // Use type assertion since trial columns may not be in generated types yet
  const { data: business, error } = await (supabase as any)
    .from("businesses")
    .select(`
      subscription_status,
      trial_ends_at,
      trial_minutes_used,
      trial_minutes_limit
    `)
    .eq("id", businessId)
    .single();

  if (error || !business) {
    return {
      isTrialing: false,
      isActive: false,
      isExpired: true,
      isMinutesExhausted: false,
      canMakeCalls: false,
      trialEndsAt: null,
      daysRemaining: 0,
      minutesUsed: 0,
      minutesLimit: 30,
      minutesRemaining: 0,
      subscriptionStatus: "unknown",
    };
  }

  const now = new Date();
  const trialEndsAt = business.trial_ends_at ? new Date(business.trial_ends_at) : null;
  const isTrialing = business.subscription_status === "trialing";
  const isActive = business.subscription_status === "active";
  const isExpired = trialEndsAt ? trialEndsAt < now : false;

  const minutesUsed = business.trial_minutes_used ?? 0;
  const minutesLimit = business.trial_minutes_limit ?? 30;
  const minutesRemaining = Math.max(0, minutesLimit - minutesUsed);
  const isMinutesExhausted = minutesUsed >= minutesLimit;

  // Calculate days remaining
  let daysRemaining = 0;
  if (trialEndsAt && !isExpired) {
    const diffMs = trialEndsAt.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  // Determine if business can make calls
  const canMakeCalls = isActive || (isTrialing && !isExpired && !isMinutesExhausted);

  return {
    isTrialing,
    isActive,
    isExpired,
    isMinutesExhausted,
    canMakeCalls,
    trialEndsAt,
    daysRemaining,
    minutesUsed,
    minutesLimit,
    minutesRemaining,
    subscriptionStatus: business.subscription_status ?? "unknown",
  };
}

/**
 * Check if a business can make AI calls
 * Returns true if active subscription or valid trial
 */
export async function canBusinessMakeCalls(businessId: string): Promise<boolean> {
  const status = await getTrialStatus(businessId);
  return status.canMakeCalls;
}

/**
 * Expire a trial (admin function)
 * Used when trial time runs out or minutes exhausted
 */
export async function expireTrial(businessId: string): Promise<void> {
  const adminClient = createAdminClient();

  await (adminClient as any)
    .from("businesses")
    .update({ subscription_status: "trial_expired" })
    .eq("id", businessId)
    .eq("subscription_status", "trialing");
}

/**
 * Convert trial to active subscription
 * Called after successful payment
 */
export async function activateSubscription(
  businessId: string,
  planId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  minutesIncluded: number
): Promise<void> {
  const adminClient = createAdminClient();

  const now = new Date();
  const cycleEnd = new Date();
  cycleEnd.setMonth(cycleEnd.getMonth() + 1);

  await (adminClient as any)
    .from("businesses")
    .update({
      subscription_status: "active",
      plan_id: planId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      minutes_included: minutesIncluded,
      minutes_used_this_cycle: 0,
      current_cycle_start: now.toISOString().split("T")[0],
      current_cycle_end: cycleEnd.toISOString().split("T")[0],
      last_usage_alert_percent: 0,
    })
    .eq("id", businessId);
}

/**
 * Get trial statistics for admin dashboard
 */
export async function getTrialStats(): Promise<{
  totalTrialing: number;
  expiringIn3Days: number;
  expiringIn1Day: number;
  expiredToday: number;
}> {
  const adminClient = createAdminClient();

  const now = new Date();
  const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // Get all trialing businesses
  const { count: totalTrialing } = await (adminClient as any)
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("subscription_status", "trialing");

  // Expiring in 3 days
  const { count: expiringIn3Days } = await (adminClient as any)
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("subscription_status", "trialing")
    .lte("trial_ends_at", threeDaysFromNow.toISOString())
    .gt("trial_ends_at", now.toISOString());

  // Expiring in 1 day
  const { count: expiringIn1Day } = await (adminClient as any)
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("subscription_status", "trialing")
    .lte("trial_ends_at", oneDayFromNow.toISOString())
    .gt("trial_ends_at", now.toISOString());

  // Expired today
  const { count: expiredToday } = await (adminClient as any)
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("subscription_status", "trial_expired")
    .gte("updated_at", startOfToday.toISOString());

  return {
    totalTrialing: totalTrialing ?? 0,
    expiringIn3Days: expiringIn3Days ?? 0,
    expiringIn1Day: expiringIn1Day ?? 0,
    expiredToday: expiredToday ?? 0,
  };
}

/**
 * Extend trial period (admin function)
 * For customer support use cases
 */
export async function extendTrial(
  businessId: string,
  additionalDays: number,
  additionalMinutes: number = 0
): Promise<void> {
  const adminClient = createAdminClient();

  // Get current trial end date
  const { data: business } = await (adminClient as any)
    .from("businesses")
    .select("trial_ends_at, trial_minutes_limit")
    .eq("id", businessId)
    .single();

  if (!business) {
    throw new Error("Business not found");
  }

  const currentEndDate = business.trial_ends_at ? new Date(business.trial_ends_at) : new Date();
  const newEndDate = new Date(currentEndDate);
  newEndDate.setDate(newEndDate.getDate() + additionalDays);

  const newMinutesLimit = (business.trial_minutes_limit ?? 30) + additionalMinutes;

  await (adminClient as any)
    .from("businesses")
    .update({
      trial_ends_at: newEndDate.toISOString(),
      trial_minutes_limit: newMinutesLimit,
      subscription_status: "trialing", // Reactivate if expired
      // Reset email flags so they can be sent again if needed
      trial_email_3day_sent: false,
      trial_email_1day_sent: false,
      trial_email_expired_sent: false,
    })
    .eq("id", businessId);
}
