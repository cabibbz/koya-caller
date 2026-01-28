/**
 * Koya Caller - Usage Alerts Background Jobs
 * Session 21: Background Jobs
 * Spec Reference: Part 6, Lines 609-613
 *
 * Handles usage monitoring and sends SMS alerts when businesses
 * approach their minute limits (50%, 80%, 95%, 100%).
 */

import { inngest } from "../client";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendUsageAlert } from "@/lib/twilio";

// Alert thresholds as defined in spec
const ALERT_THRESHOLDS = [50, 80, 95, 100] as const;

// =============================================================================
// Check All Businesses for Usage Alerts (Scheduled Job)
// =============================================================================

/**
 * Scheduled job to check all active businesses for usage alerts
 * Runs every hour
 * Spec Reference: Part 6, Lines 609-613
 */
export const checkUsageAlerts = inngest.createFunction(
  {
    id: "usage-check-alerts",
    name: "Check Usage Alerts",
  },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    const supabase = createAdminClient();

    // Fetch all active businesses with their usage and alert status
    const businesses = await step.run("fetch-active-businesses", async () => {
      const { data, error } = await (supabase as any)
        .from("businesses")
        .select(`
          id,
          minutes_used_this_cycle,
          minutes_included,
          last_usage_alert_percent,
          users!inner (
            phone
          ),
          phone_numbers (
            number
          )
        `)
        .eq("subscription_status", "active");

      if (error) {
        throw new Error(`Failed to fetch businesses: ${error.message}`);
      }

      return data || [];
    });

    if (businesses.length === 0) {
      return { checked: 0, alerts: 0 };
    }

    let alertsSent = 0;

    for (const business of businesses) {
      const minutesUsed = business.minutes_used_this_cycle || 0;
      const minutesLimit = business.minutes_included || 200;
      const lastAlertPercent = business.last_usage_alert_percent || 0;
      const percentUsed = Math.floor((minutesUsed / minutesLimit) * 100);

      // Find the next threshold to alert
      const nextThreshold = ALERT_THRESHOLDS.find(
        (t) => t > lastAlertPercent && percentUsed >= t
      );

      if (nextThreshold && business.users?.phone) {
        // Send the alert
        await step.run(`send-alert-${business.id}`, async () => {
          const fromNumber = business.phone_numbers?.[0]?.number || process.env.TWILIO_PHONE_NUMBER;

          await sendUsageAlert({
            to: business.users.phone,
            from: fromNumber || "+10000000000",
            percentUsed: nextThreshold,
            minutesUsed,
            minutesIncluded: minutesLimit,
          });

          // Update last alert threshold
          await (supabase as any)
            .from("businesses")
            .update({ last_usage_alert_percent: nextThreshold })
            .eq("id", business.id);
        });

        alertsSent++;
      }
    }

    return {
      checked: businesses.length,
      alerts: alertsSent,
    };
  }
);

// =============================================================================
// Send Individual Usage Alert
// =============================================================================

/**
 * Send a usage alert for a specific business
 * Can be triggered manually or by call completion webhook
 */
export const sendUsageAlertEvent = inngest.createFunction(
  {
    id: "usage-alert-send",
    name: "Send Usage Alert",
    retries: 3,
  },
  { event: "usage/alert.send" },
  async ({ event, step }) => {
    const { businessId, percentUsed, minutesUsed, minutesIncluded } = event.data;
    const supabase = createAdminClient();

    // Fetch business owner phone and Koya number
    const businessData = await step.run("fetch-business-data", async () => {
      const { data, error } = await (supabase as any)
        .from("businesses")
        .select(`
          id,
          last_usage_alert_percent,
          users!inner (
            phone
          ),
          phone_numbers (
            number
          )
        `)
        .eq("id", businessId)
        .single();

      if (error || !data) {
        throw new Error("Business not found");
      }

      return data;
    });

    // Check if we've already sent this alert level
    if (businessData.last_usage_alert_percent >= percentUsed) {
      return { skipped: true, reason: "Alert already sent for this threshold" };
    }

    // Validate owner has phone number
    if (!businessData.users?.phone) {
      return { skipped: true, reason: "No owner phone number" };
    }

    // Send the SMS
    await step.run("send-sms", async () => {
      const fromNumber = businessData.phone_numbers?.[0]?.number || process.env.TWILIO_PHONE_NUMBER;

      await sendUsageAlert({
        to: businessData.users.phone,
        from: fromNumber || "+10000000000",
        percentUsed,
        minutesUsed,
        minutesIncluded,
      });
    });

    // Update last alert threshold
    await step.run("update-alert-threshold", async () => {
      // Find the threshold we just crossed
      const threshold = ALERT_THRESHOLDS.find((t) => percentUsed >= t && t > businessData.last_usage_alert_percent) || percentUsed;

      await (supabase as any)
        .from("businesses")
        .update({ last_usage_alert_percent: threshold })
        .eq("id", businessId);
    });

    return {
      success: true,
      businessId,
      percentUsed,
      alertSent: true,
    };
  }
);

// =============================================================================
// Reset Usage Alerts (for billing cycle reset)
// =============================================================================

/**
 * Reset usage alert thresholds when billing cycle resets
 * Called by Stripe webhook when subscription renews
 */
export const resetUsageAlerts = inngest.createFunction(
  {
    id: "usage-alerts-reset",
    name: "Reset Usage Alerts for Billing Cycle",
  },
  { event: "stripe/subscription.renewed" as any },
  async ({ event, step }) => {
    const { businessId } = event.data as { businessId: string };
    const supabase = createAdminClient();

    await step.run("reset-alert-threshold", async () => {
      await (supabase as any)
        .from("businesses")
        .update({
          last_usage_alert_percent: 0,
          minutes_used_this_cycle: 0,
        })
        .eq("id", businessId);
    });

    return { success: true, businessId };
  }
);
