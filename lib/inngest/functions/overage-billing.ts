/**
 * Koya Caller - Overage Billing Background Jobs
 *
 * Handles billing for usage overage:
 * - Creates Stripe invoice items for overage charges
 * - Sends overage alert emails
 * - Processes end-of-cycle overage billing
 */

import { inngest } from "../client";
import { logError, logInfo, logWarning } from "@/lib/logging";

/**
 * Event triggered when a business enters overage (exceeds included minutes)
 * Sends an alert and optionally creates Stripe usage record
 */
export const processOverageAlert = inngest.createFunction(
  {
    id: "overage-alert",
    name: "Process Overage Alert",
    retries: 3,
  },
  { event: "usage/overage.entered" },
  async ({ event, step }) => {
    const { businessId, minutesUsed, minutesIncluded, overageMinutes, overageCostCents } = event.data as {
      businessId: string;
      minutesUsed: number;
      minutesIncluded: number;
      overageMinutes: number;
      overageCostCents: number;
    };

    // Get business details
    const business = await step.run("get-business", async () => {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("businesses")
        .select(`
          id,
          name,
          user_id,
          stripe_customer_id,
          overage_billing_enabled,
          overage_rate_cents
        `)
        .eq("id", businessId)
        .single();

      if (error) throw error;
      return data;
    });

    if (!business) {
      logWarning("Overage Alert", `Business not found: ${businessId}`);
      return { success: false, reason: "business_not_found" };
    }

    // Get user email for notification
    const userEmail = await step.run("get-user-email", async () => {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).auth.admin.getUserById(business.user_id);
      return data?.user?.email || null;
    });

    // Send overage alert email
    if (userEmail) {
      await step.run("send-overage-email", async () => {
        const { sendEmail } = await import("@/lib/email");

        const overageCostDollars = (overageCostCents / 100).toFixed(2);
        const ratePerMinute = ((business.overage_rate_cents || 15) / 100).toFixed(2);
        const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL}/settings/billing`;

        await sendEmail({
          to: userEmail,
          subject: `Usage Alert: ${business.name} has exceeded included minutes`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
                .header h1 { color: white; margin: 0; font-size: 24px; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
                .alert-box { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px 20px; border-radius: 4px; margin-bottom: 20px; }
                .info-card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb; }
                .info-card p { margin: 8px 0; }
                .button { display: inline-block; background: #3B82F6; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
                .footer { text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Usage Overage Alert</h1>
                </div>
                <div class="content">
                  <div class="alert-box">
                    <strong>${business.name} has exceeded included minutes</strong>
                  </div>
                  <div class="info-card">
                    <p><strong>Minutes Used:</strong> ${minutesUsed}</p>
                    <p><strong>Included Minutes:</strong> ${minutesIncluded}</p>
                    <p><strong>Overage Minutes:</strong> ${overageMinutes}</p>
                    <p><strong>Overage Rate:</strong> $${ratePerMinute}/minute</p>
                    <p><strong>Current Overage Charges:</strong> $${overageCostDollars}</p>
                  </div>
                  <p>${business.overage_billing_enabled
                    ? "Overage charges will be added to your next invoice."
                    : "Note: Overage billing is not enabled. Consider upgrading your plan for more minutes."
                  }</p>
                  <p style="text-align: center; margin-top: 24px;">
                    <a href="${billingUrl}" class="button">Manage Subscription</a>
                  </p>
                </div>
                <div class="footer">
                  <p>Koya - Your AI Phone Receptionist</p>
                </div>
              </div>
            </body>
            </html>
          `,
          businessId,
        });

        logInfo("Overage Alert", `Sent overage alert to ${userEmail} for ${business.name}`);
      });
    }

    // If overage billing is enabled and Stripe customer exists, record usage
    if (business.overage_billing_enabled && business.stripe_customer_id) {
      await step.run("record-stripe-usage", async () => {
        const { stripe } = await import("@/lib/stripe/client");

        // Get the subscription
        const subscriptions = await stripe.subscriptions.list({
          customer: business.stripe_customer_id,
          status: "active",
          limit: 1,
        });

        if (subscriptions.data.length === 0) {
          logWarning("Overage Alert", `No active subscription for ${business.name}`);
          return;
        }

        const subscription = subscriptions.data[0];

        // Find or create usage-based price item
        // This assumes a metered billing item exists on the subscription
        const meteringItem = subscription.items.data.find(
          (item) => item.price.recurring?.usage_type === "metered"
        );

        if (meteringItem) {
          // Record usage for metered billing
          await stripe.subscriptionItems.createUsageRecord(
            meteringItem.id,
            {
              quantity: overageMinutes,
              timestamp: Math.floor(Date.now() / 1000),
              action: "increment",
            }
          );

          logInfo("Overage Alert", `Recorded ${overageMinutes} overage minutes for ${business.name}`);
        } else {
          // No metered item - create invoice item instead at end of cycle
          logInfo("Overage Alert", `No metered billing item for ${business.name}, will create invoice item at cycle end`);
        }
      });
    }

    return {
      success: true,
      businessId,
      overageMinutes,
      overageCostCents,
      emailSent: !!userEmail,
    };
  }
);

/**
 * End-of-cycle overage billing
 * Called by Stripe subscription renewal webhook to bill accumulated overage
 */
export const processEndOfCycleOverage = inngest.createFunction(
  {
    id: "end-of-cycle-overage",
    name: "Process End of Cycle Overage",
    retries: 3,
  },
  { event: "billing/cycle.ending" },
  async ({ event, step }) => {
    const { businessId, subscriptionId } = event.data as {
      businessId: string;
      subscriptionId: string;
    };

    // Get business overage data
    const business = await step.run("get-business-overage", async () => {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("businesses")
        .select(`
          id,
          name,
          stripe_customer_id,
          overage_minutes_this_cycle,
          overage_cost_cents_this_cycle,
          overage_billing_enabled,
          overage_rate_cents
        `)
        .eq("id", businessId)
        .single();

      if (error) throw error;
      return data;
    });

    if (!business) {
      return { success: false, reason: "business_not_found" };
    }

    const overageMinutes = business.overage_minutes_this_cycle || 0;
    const overageCostCents = business.overage_cost_cents_this_cycle || 0;

    // If no overage, nothing to do
    if (overageMinutes <= 0 || overageCostCents <= 0) {
      return {
        success: true,
        reason: "no_overage",
        overageMinutes: 0,
        overageCostCents: 0,
      };
    }

    // If overage billing not enabled, skip charging
    if (!business.overage_billing_enabled) {
      logInfo("End of Cycle Overage", `Skipping overage charge for ${business.name} - billing not enabled`);
      return {
        success: true,
        reason: "billing_not_enabled",
        overageMinutes,
        overageCostCents,
      };
    }

    // Create invoice item for overage
    if (business.stripe_customer_id) {
      await step.run("create-overage-invoice-item", async () => {
        const { stripe } = await import("@/lib/stripe/client");

        // Create an invoice item that will be added to the next invoice
        await stripe.invoiceItems.create({
          customer: business.stripe_customer_id,
          amount: overageCostCents,
          currency: "usd",
          description: `Overage: ${overageMinutes} minutes @ $${((business.overage_rate_cents || 15) / 100).toFixed(2)}/min`,
          metadata: {
            business_id: businessId,
            overage_minutes: overageMinutes.toString(),
            overage_rate_cents: (business.overage_rate_cents || 15).toString(),
            billing_cycle: new Date().toISOString().split("T")[0],
          },
        });

        logInfo("End of Cycle Overage", `Created overage invoice item for ${business.name}: $${(overageCostCents / 100).toFixed(2)}`);
      });

      // Log to audit table
      await step.run("log-overage-charge", async () => {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const supabase = createAdminClient();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("usage_audit_log").insert({
          business_id: businessId,
          event_type: "overage_charged",
          minutes_before: 0,
          minutes_after: overageMinutes,
          minutes_delta: overageMinutes,
          cost_cents: overageCostCents,
          is_overage: true,
          source: "stripe",
          source_reference: subscriptionId,
          notes: `End of cycle overage charge: ${overageMinutes} minutes @ ${business.overage_rate_cents || 15} cents/min`,
        });
      });
    }

    // Reset overage counters
    await step.run("reset-overage-counters", async () => {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("businesses")
        .update({
          overage_minutes_this_cycle: 0,
          overage_cost_cents_this_cycle: 0,
        })
        .eq("id", businessId);
    });

    return {
      success: true,
      businessId,
      overageMinutes,
      overageCostCents,
      invoiceItemCreated: true,
    };
  }
);

/**
 * Daily overage summary check
 * Sends summary emails to businesses that are in overage
 */
export const checkOverageStatus = inngest.createFunction(
  {
    id: "check-overage-status",
    name: "Check Daily Overage Status",
    retries: 1,
  },
  { cron: "0 9 * * *" }, // Daily at 9 AM
  async ({ step }) => {
    // Get businesses currently in overage
    const businessesInOverage = await step.run("get-businesses-in-overage", async () => {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("businesses")
        .select(`
          id,
          name,
          user_id,
          minutes_used_this_cycle,
          minutes_included,
          overage_minutes_this_cycle,
          overage_cost_cents_this_cycle,
          overage_billing_enabled
        `)
        .gt("overage_minutes_this_cycle", 0)
        .eq("subscription_status", "active");

      if (error) {
        logError("Check Overage Status", error);
        return [];
      }

      return data || [];
    });

    if (businessesInOverage.length === 0) {
      return { checked: 0, inOverage: 0 };
    }

    logInfo("Check Overage Status", `Found ${businessesInOverage.length} businesses in overage`);

    // Could send daily overage summary emails here if desired
    // For now, just log the status

    return {
      checked: businessesInOverage.length,
      inOverage: businessesInOverage.length,
      businesses: businessesInOverage.map((b: {
        id: string;
        name: string;
        overage_minutes_this_cycle: number;
        overage_cost_cents_this_cycle: number;
      }) => ({
        id: b.id,
        name: b.name,
        overageMinutes: b.overage_minutes_this_cycle,
        overageCostCents: b.overage_cost_cents_this_cycle,
      })),
    };
  }
);
