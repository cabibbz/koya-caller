/**
 * Koya Caller - Failed Webhook Retry Background Job
 * Processes failed incoming webhooks from external services (Stripe, Retell, Twilio)
 * with exponential backoff
 *
 * This is SEPARATE from webhook-retries.ts which handles OUTBOUND webhook retries
 * - This module: Retries failed INCOMING webhooks from external services
 * - webhook-retries.ts: Retries failed OUTGOING webhooks to business endpoints
 */

import { inngest } from "../client";
import {
  getWebhooksToRetry,
  markWebhookSuccess,
  markWebhookFailed,
  cleanupOldWebhooks,
  type FailedWebhook,
} from "@/lib/webhooks/retry";
import { logInfo } from "@/lib/logging";

// =============================================================================
// Webhook Processors
// =============================================================================

/**
 * Process a Stripe webhook retry
 */
async function processStripeWebhook(webhook: FailedWebhook): Promise<void> {
  // Dynamic import to avoid circular dependencies
  const { stripe } = await import("@/lib/stripe/client");
  const { createAdminClient } = await import("@/lib/supabase/admin");

  const supabase = createAdminClient();
  const eventType = webhook.event_type;
  const payload = webhook.payload as Record<string, any>;

  // Re-process the webhook based on event type
  // The payload contains the original Stripe event data
  switch (eventType) {
    case "checkout.session.completed": {
      const session = payload.data?.object || payload;
      const businessId = (session as any).metadata?.business_id;
      const customerId = (session as any).customer;
      const subscriptionId = (session as any).subscription;

      if (!businessId) {
        throw new Error("No business_id in checkout session metadata");
      }

      // Get subscription for plan details
      let includedMinutes = 200;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
        const priceId = subscription.items.data[0]?.price?.id;
        if (priceId) {
          const { data: plan } = await (supabase as any)
            .from("plans")
            .select("included_minutes")
            .eq("stripe_price_id", priceId)
            .single();
          if (plan) {
            includedMinutes = plan.included_minutes;
          }
        }
      }

      await (supabase as any)
        .from("businesses")
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: "active",
          minutes_included: includedMinutes,
          current_cycle_start: new Date().toISOString().split("T")[0],
          current_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          minutes_used_this_cycle: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", businessId);
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.created":
    case "customer.subscription.deleted": {
      const subscription = payload.data?.object || payload;
      const customerId = (subscription as any).customer;

      const { data: business } = await (supabase as any)
        .from("businesses")
        .select("id")
        .or(`stripe_subscription_id.eq.${(subscription as any).id},stripe_customer_id.eq.${customerId}`)
        .single();

      if (!business) {
        throw new Error(`Business not found for subscription ${(subscription as any).id}`);
      }

      let status = "active";
      if (eventType === "customer.subscription.deleted") {
        status = "cancelled";
      } else if ((subscription as any).status === "past_due" || (subscription as any).status === "unpaid") {
        status = "paused";
      }

      await (supabase as any)
        .from("businesses")
        .update({
          subscription_status: status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", business.id);
      break;
    }

    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const invoice = payload.data?.object || payload;
      const subscriptionId = (invoice as any).subscription;
      if (!subscriptionId) break;

      const { data: business } = await (supabase as any)
        .from("businesses")
        .select("id")
        .eq("stripe_subscription_id", subscriptionId)
        .single();

      if (!business) break;

      if (eventType === "invoice.payment_succeeded") {
        await (supabase as any)
          .from("businesses")
          .update({
            subscription_status: "active",
            minutes_used_this_cycle: 0,
            last_usage_alert_percent: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", business.id);
      } else {
        await (supabase as any)
          .from("businesses")
          .update({
            subscription_status: "paused",
            updated_at: new Date().toISOString(),
          })
          .eq("id", business.id);
      }
      break;
    }

    default:
      logInfo("Stripe Webhook Retry", `Unhandled event type: ${eventType}`);
  }
}

/**
 * Process a Retell webhook retry
 */
async function processRetellWebhook(webhook: FailedWebhook): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const { getCallDetails } = await import("@/lib/retell");

  const supabase = createAdminClient() as any;
  const eventType = webhook.event_type;
  const payload = webhook.payload as any;
  const call = payload.call || payload;

  // Look up business by agent_id
  const { data: aiConfig } = await supabase
    .from("ai_config")
    .select("business_id")
    .eq("retell_agent_id", call.agent_id)
    .single();

  const businessId = aiConfig?.business_id || call.metadata?.businessId;
  if (!businessId) {
    throw new Error("Cannot determine business ID from Retell webhook");
  }

  switch (eventType) {
    case "call_started": {
      await supabase.from("calls").insert({
        business_id: businessId,
        retell_call_id: call.call_id,
        from_number: call.from_number || null,
        to_number: call.to_number || null,
        started_at: call.start_timestamp
          ? new Date(call.start_timestamp).toISOString()
          : new Date().toISOString(),
        outcome: null,
        language: "en",
      });
      break;
    }

    case "call_ended": {
      // Fetch full call details from Retell API
      const retellCallDetails = await getCallDetails(call.call_id);

      let durationSeconds = 0;
      let recordingUrl: string | null = null;
      let startTimestamp = call.start_timestamp;
      let endTimestamp = call.end_timestamp;

      if (retellCallDetails) {
        durationSeconds = Math.ceil(retellCallDetails.duration_ms / 1000);
        recordingUrl = retellCallDetails.recording_url;
        startTimestamp = retellCallDetails.start_timestamp || startTimestamp;
        endTimestamp = retellCallDetails.end_timestamp || endTimestamp;
      } else if (payload.duration_ms || call.duration_ms) {
        durationSeconds = Math.ceil((payload.duration_ms || call.duration_ms) / 1000);
      }

      const durationMinutesBilled = durationSeconds > 0 ? Math.max(1, Math.ceil(durationSeconds / 60)) : 0;

      // Determine outcome
      let outcome = "info";
      const metadata = call.metadata || {};
      if (metadata.appointment_booked === "true") outcome = "booked";
      else if (metadata.transferred === "true") outcome = "transferred";
      else if (metadata.message_taken === "true") outcome = "message";
      else if (call.disconnection_reason === "user_hangup" && durationSeconds < 10) outcome = "missed";

      // Upsert call record
      await supabase
        .from("calls")
        .upsert({
          business_id: businessId,
          retell_call_id: call.call_id,
          from_number: call.from_number || null,
          to_number: call.to_number || null,
          started_at: startTimestamp ? new Date(startTimestamp).toISOString() : null,
          ended_at: endTimestamp ? new Date(endTimestamp).toISOString() : new Date().toISOString(),
          duration_seconds: durationSeconds,
          duration_minutes_billed: durationMinutesBilled,
          recording_url: recordingUrl,
          outcome: outcome,
        }, {
          onConflict: "retell_call_id",
          ignoreDuplicates: false,
        });

      // Update minutes usage
      if (durationMinutesBilled > 0) {
        const { data: businessData } = await supabase
          .from("businesses")
          .select("subscription_status")
          .eq("id", businessId)
          .single();

        if (businessData?.subscription_status === "trialing") {
          await supabase.rpc("increment_trial_minutes", {
            p_business_id: businessId,
            p_minutes: durationMinutesBilled,
          });
        } else {
          await supabase.rpc("increment_minutes_used", {
            p_business_id: businessId,
            p_minutes: durationMinutesBilled,
          });
        }
      }
      break;
    }

    case "call_analyzed": {
      const analysis = call.call_analysis;
      if (!analysis) break;

      const { data: existingCall } = await supabase
        .from("calls")
        .select("id, outcome")
        .eq("retell_call_id", call.call_id)
        .single();

      if (existingCall) {
        const leadInfo = analysis.custom_analysis_data || {};
        let outcome = existingCall.outcome;
        if (analysis.custom_analysis_data?.appointment_booked) {
          outcome = "booked";
        }

        await supabase
          .from("calls")
          .update({
            summary: analysis.call_summary || null,
            outcome: outcome,
            lead_info: leadInfo,
          })
          .eq("id", existingCall.id);
      }
      break;
    }

    default:
      logInfo("Retell Webhook Retry", `Unhandled event type: ${eventType}`);
  }
}

/**
 * Process a Twilio webhook retry
 */
async function processTwilioWebhook(webhook: FailedWebhook): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/server");

  const supabase = createAdminClient() as any;
  const payload = webhook.payload as any;

  const callStatus = payload.CallStatus || "";
  const callDuration = parseInt(payload.CallDuration || "0", 10);
  const fromNumber = payload.From || "";
  const toNumber = payload.To || payload.Called || "";
  const timestamp = payload.Timestamp || new Date().toISOString();

  // Look up business from phone number
  const { data: phoneRecord } = await supabase
    .from("phone_numbers")
    .select("business_id")
    .eq("number", toNumber)
    .eq("is_active", true)
    .single();

  if (!phoneRecord?.business_id) {
    // Unknown number - nothing to process
    return;
  }

  const businessId = phoneRecord.business_id;

  switch (callStatus) {
    case "completed":
      await supabase
        .from("calls")
        .update({
          ended_at: timestamp,
          duration_seconds: callDuration,
          duration_minutes_billed: Math.ceil(callDuration / 60),
        })
        .eq("business_id", businessId)
        .eq("from_number", fromNumber)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1);
      break;

    case "busy":
    case "no-answer":
    case "canceled":
      await supabase
        .from("calls")
        .insert({
          business_id: businessId,
          from_number: fromNumber,
          to_number: toNumber,
          started_at: timestamp,
          ended_at: timestamp,
          duration_seconds: 0,
          duration_minutes_billed: 0,
          outcome: "missed",
          summary: `Missed call (${callStatus})`,
        });
      break;

    default:
      // Other statuses don't require action
  }
}

// =============================================================================
// Main Retry Processor
// =============================================================================

/**
 * Process a single failed webhook
 */
async function processWebhook(webhook: FailedWebhook): Promise<boolean> {
  try {
    switch (webhook.source) {
      case "stripe":
        await processStripeWebhook(webhook);
        break;
      case "retell":
        await processRetellWebhook(webhook);
        break;
      case "twilio":
        await processTwilioWebhook(webhook);
        break;
      default:
        throw new Error(`Unknown webhook source: ${webhook.source}`);
    }

    // Mark as successful
    await markWebhookSuccess(webhook.id);
    return true;
  } catch (error) {
    // Mark as failed and schedule next retry
    await markWebhookFailed(webhook.id, error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

// =============================================================================
// Inngest Functions
// =============================================================================

/**
 * Scheduled job to process all pending failed webhook retries
 * Runs every 5 minutes to check for webhooks ready for retry
 */
export const processFailedWebhookRetries = inngest.createFunction(
  {
    id: "failed-webhook-process-retries",
    name: "Process Failed Webhook Retries",
    retries: 1,
  },
  { cron: "*/5 * * * *" }, // Every 5 minutes
  async ({ step }) => {
    // Get webhooks ready for retry
    const webhooksToRetry = await step.run("get-webhooks-to-retry", async () => {
      return getWebhooksToRetry(50);
    });

    if (webhooksToRetry.length === 0) {
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        message: "No webhooks pending retry",
      };
    }

    let succeeded = 0;
    let failed = 0;

    // Process each webhook
    for (const webhook of webhooksToRetry) {
      const result = await step.run(`process-${webhook.id}`, async () => {
        return processWebhook(webhook);
      });

      if (result) {
        succeeded++;
      } else {
        failed++;
      }
    }

    const message = `Processed ${webhooksToRetry.length} webhooks: ${succeeded} succeeded, ${failed} failed`;
    logInfo("Failed Webhook Retry", message);

    return {
      processed: webhooksToRetry.length,
      succeeded,
      failed,
      message,
    };
  }
);

/**
 * Scheduled job to clean up old successful webhooks
 * Runs daily at 3 AM
 */
export const cleanupOldFailedWebhooks = inngest.createFunction(
  {
    id: "failed-webhook-cleanup",
    name: "Cleanup Old Failed Webhooks",
    retries: 1,
  },
  { cron: "0 3 * * *" }, // Daily at 3 AM
  async ({ step }) => {
    const count = await step.run("cleanup-old-webhooks", async () => {
      return cleanupOldWebhooks(7);
    });

    return {
      deleted: count,
      message: `Cleaned up ${count} old successful webhooks`,
    };
  }
);

/**
 * Event-triggered function for immediate webhook retry
 * Can be triggered manually from admin UI
 */
export const retryFailedWebhook = inngest.createFunction(
  {
    id: "failed-webhook-retry-single",
    name: "Retry Single Failed Webhook",
    retries: 0,
  },
  { event: "webhook/failed.retry" },
  async ({ event, step }) => {
    const { webhookId } = event.data as { webhookId: string };

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    // Get the webhook
    const webhook = await step.run("get-webhook", async () => {
      const { data, error } = await (supabase as any)
        .from("failed_webhooks")
        .select("*")
        .eq("id", webhookId)
        .single();

      if (error || !data) {
        throw new Error("Failed webhook not found");
      }

      return data as FailedWebhook;
    });

    // Process the webhook
    const result = await step.run("process-webhook", async () => {
      return processWebhook(webhook);
    });

    return {
      webhookId,
      success: result,
      source: webhook.source,
      eventType: webhook.event_type,
    };
  }
);
