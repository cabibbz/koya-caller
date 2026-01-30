/**
 * Koya Caller - Webhook Retry Background Job
 * Processes failed webhook deliveries with exponential backoff
 *
 * This job runs periodically to retry any webhook deliveries that
 * failed but haven't exceeded their maximum retry attempts.
 */

import { inngest } from "../client";
import { processPendingRetries } from "@/lib/webhooks";

// =============================================================================
// Process Pending Webhook Retries (Scheduled Job)
// =============================================================================

/**
 * Scheduled job to process all pending webhook retries
 * Runs every minute to check for deliveries ready for retry
 */
export const processWebhookRetries = inngest.createFunction(
  {
    id: "webhook-process-retries",
    name: "Process Webhook Retries",
    retries: 1, // Don't retry this job too many times as it will run again soon
  },
  { cron: "* * * * *" }, // Every minute
  async ({ step }) => {
    const result = await step.run("process-pending-retries", async () => {
      return processPendingRetries();
    });

    return {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
    };
  }
);

// =============================================================================
// Manual Retry Trigger
// =============================================================================

/**
 * Event-driven function to immediately retry a specific webhook delivery
 * Can be triggered from the UI for manual retries
 */
export const retryWebhookDelivery = inngest.createFunction(
  {
    id: "webhook-retry-delivery",
    name: "Retry Webhook Delivery",
    retries: 0, // Don't auto-retry this, the delivery has its own retry logic
  },
  { event: "webhook/delivery.retry" },
  async ({ event, step }) => {
    const { deliveryId } = event.data as { deliveryId: string };

    const { retryWebhookDelivery: doRetry, getPendingRetryDeliveries: _getPendingRetryDeliveries } = await import(
      "@/lib/webhooks"
    );
    const { createAdminClient } = await import("@/lib/supabase/server");

    const supabase = createAdminClient();

    // Get the delivery
    const delivery = await step.run("get-delivery", async () => {
      const { data, error } = await (supabase as any)
        .from("webhook_deliveries")
        .select("*")
        .eq("id", deliveryId)
        .single();

      if (error || !data) {
        throw new Error("Delivery not found");
      }

      return data;
    });

    // Retry the delivery
    const result = await step.run("retry-delivery", async () => {
      return doRetry(delivery);
    });

    return {
      deliveryId,
      success: result.success,
      error: result.error,
    };
  }
);
