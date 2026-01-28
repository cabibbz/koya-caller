/**
 * Incoming Webhook Retry Library
 * Handles storage and retry of failed incoming webhooks from external services
 * (Stripe, Retell, Twilio)
 *
 * This is SEPARATE from outbound webhook dispatch logic in dispatcher.ts
 * - This module: Retries failed INCOMING webhooks from external services
 * - dispatcher.ts: Retries failed OUTGOING webhooks to business endpoints
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logError, logInfo, logErrorWithMeta } from "@/lib/logging";

// =============================================================================
// Types
// =============================================================================

export type WebhookSource = "stripe" | "retell" | "twilio";

export type FailedWebhookStatus = "pending" | "retrying" | "success" | "failed";

export interface FailedWebhook {
  id: string;
  source: WebhookSource;
  event_type: string;
  payload: Record<string, unknown>;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  status: FailedWebhookStatus;
  created_at: string;
  updated_at: string;
}

export interface StoreFailedWebhookParams {
  source: WebhookSource;
  eventType: string;
  payload: Record<string, unknown>;
  error: Error | string;
}

// =============================================================================
// Exponential Backoff Configuration
// =============================================================================

/**
 * Retry delays in milliseconds
 * 0: 1 minute
 * 1: 5 minutes
 * 2: 15 minutes
 * 3: 1 hour
 * 4: 4 hours
 */
const RETRY_DELAYS_MS = [
  1 * 60 * 1000,        // 1 minute
  5 * 60 * 1000,        // 5 minutes
  15 * 60 * 1000,       // 15 minutes
  60 * 60 * 1000,       // 1 hour
  4 * 60 * 60 * 1000,   // 4 hours
];

/**
 * Calculate the next retry timestamp based on retry count
 */
function calculateNextRetryAt(retryCount: number): Date {
  const delayIndex = Math.min(retryCount, RETRY_DELAYS_MS.length - 1);
  const delayMs = RETRY_DELAYS_MS[delayIndex];
  return new Date(Date.now() + delayMs);
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Store a failed webhook for later retry
 * Called when webhook processing fails with an error
 */
export async function storeFailedWebhook(
  params: StoreFailedWebhookParams
): Promise<FailedWebhook | null> {
  const { source, eventType, payload, error } = params;
  const supabase = createAdminClient();

  const errorMessage = error instanceof Error ? error.message : String(error);
  const nextRetryAt = calculateNextRetryAt(0);

  try {
    const { data, error: dbError } = await (supabase as any)
      .from("failed_webhooks")
      .insert({
        source,
        event_type: eventType,
        payload,
        error_message: errorMessage,
        retry_count: 0,
        max_retries: 5,
        next_retry_at: nextRetryAt.toISOString(),
        status: "pending",
      })
      .select()
      .single();

    if (dbError) {
      logErrorWithMeta("Store Failed Webhook", dbError, {
        source,
        eventType,
      });
      return null;
    }

    logInfo(
      "Store Failed Webhook",
      `Stored ${source}/${eventType} for retry at ${nextRetryAt.toISOString()}`
    );

    return data as FailedWebhook;
  } catch (err) {
    logError("Store Failed Webhook", err);
    return null;
  }
}

/**
 * Get webhooks that are ready for retry
 * Fetches webhooks where status is 'pending' or 'retrying' and next_retry_at <= now
 */
export async function getWebhooksToRetry(
  limit: number = 50
): Promise<FailedWebhook[]> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  try {
    const { data, error } = await (supabase as any)
      .from("failed_webhooks")
      .select("*")
      .in("status", ["pending", "retrying"])
      .lte("next_retry_at", now)
      .order("next_retry_at", { ascending: true })
      .limit(limit);

    if (error) {
      logError("Get Webhooks To Retry", error);
      return [];
    }

    return (data || []) as FailedWebhook[];
  } catch (err) {
    logError("Get Webhooks To Retry", err);
    return [];
  }
}

/**
 * Mark a webhook as successfully processed
 */
export async function markWebhookSuccess(id: string): Promise<boolean> {
  const supabase = createAdminClient();

  try {
    const { error } = await (supabase as any)
      .from("failed_webhooks")
      .update({
        status: "success",
        next_retry_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      logErrorWithMeta("Mark Webhook Success", error, { id });
      return false;
    }

    logInfo("Mark Webhook Success", `Webhook ${id} marked as success`);
    return true;
  } catch (err) {
    logError("Mark Webhook Success", err);
    return false;
  }
}

/**
 * Mark a webhook as failed with a new error
 * Increments retry count and either schedules next retry or marks as permanently failed
 */
export async function markWebhookFailed(
  id: string,
  error: Error | string
): Promise<boolean> {
  const supabase = createAdminClient();
  const errorMessage = error instanceof Error ? error.message : String(error);

  try {
    // First, get the current webhook to check retry count
    const { data: webhook, error: fetchError } = await (supabase as any)
      .from("failed_webhooks")
      .select("retry_count, max_retries, source, event_type")
      .eq("id", id)
      .single();

    if (fetchError || !webhook) {
      logErrorWithMeta("Mark Webhook Failed", fetchError || new Error("Webhook not found"), { id });
      return false;
    }

    const newRetryCount = (webhook.retry_count || 0) + 1;

    if (newRetryCount >= (webhook.max_retries || 5)) {
      // Permanently failed - no more retries
      const { error: updateError } = await (supabase as any)
        .from("failed_webhooks")
        .update({
          status: "failed",
          retry_count: newRetryCount,
          error_message: errorMessage,
          next_retry_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) {
        logErrorWithMeta("Mark Webhook Failed", updateError, { id });
        return false;
      }

      logErrorWithMeta(
        "Webhook Permanently Failed",
        new Error(`Max retries exceeded for ${webhook.source}/${webhook.event_type}`),
        {
          id,
          source: webhook.source,
          eventType: webhook.event_type,
          retries: newRetryCount,
        }
      );

      return true;
    }

    // Schedule next retry
    const nextRetryAt = calculateNextRetryAt(newRetryCount);

    const { error: updateError } = await (supabase as any)
      .from("failed_webhooks")
      .update({
        status: "retrying",
        retry_count: newRetryCount,
        error_message: errorMessage,
        next_retry_at: nextRetryAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      logErrorWithMeta("Mark Webhook Failed", updateError, { id });
      return false;
    }

    logInfo(
      "Mark Webhook Failed",
      `Webhook ${id} scheduled for retry ${newRetryCount} at ${nextRetryAt.toISOString()}`
    );

    return true;
  } catch (err) {
    logError("Mark Webhook Failed", err);
    return false;
  }
}

/**
 * Get statistics for failed webhooks
 */
export async function getFailedWebhookStats(): Promise<{
  pending: number;
  retrying: number;
  failed: number;
  success: number;
  bySource: Record<WebhookSource, number>;
}> {
  const supabase = createAdminClient();

  try {
    const { data, error } = await (supabase as any)
      .from("failed_webhooks")
      .select("status, source");

    if (error) {
      logError("Get Failed Webhook Stats", error);
      return {
        pending: 0,
        retrying: 0,
        failed: 0,
        success: 0,
        bySource: { stripe: 0, retell: 0, twilio: 0 },
      };
    }

    const records = (data || []) as Array<{ status: string; source: string }>;

    const stats = {
      pending: records.filter((r) => r.status === "pending").length,
      retrying: records.filter((r) => r.status === "retrying").length,
      failed: records.filter((r) => r.status === "failed").length,
      success: records.filter((r) => r.status === "success").length,
      bySource: {
        stripe: records.filter((r) => r.source === "stripe").length,
        retell: records.filter((r) => r.source === "retell").length,
        twilio: records.filter((r) => r.source === "twilio").length,
      },
    };

    return stats;
  } catch (err) {
    logError("Get Failed Webhook Stats", err);
    return {
      pending: 0,
      retrying: 0,
      failed: 0,
      success: 0,
      bySource: { stripe: 0, retell: 0, twilio: 0 },
    };
  }
}

/**
 * Clean up old successful webhooks (older than 7 days)
 */
export async function cleanupOldWebhooks(daysOld: number = 7): Promise<number> {
  const supabase = createAdminClient();
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  try {
    const { data, error } = await (supabase as any)
      .from("failed_webhooks")
      .delete()
      .eq("status", "success")
      .lt("updated_at", cutoffDate.toISOString())
      .select("id");

    if (error) {
      logError("Cleanup Old Webhooks", error);
      return 0;
    }

    const count = (data || []).length;
    if (count > 0) {
      logInfo("Cleanup Old Webhooks", `Deleted ${count} old successful webhooks`);
    }

    return count;
  } catch (err) {
    logError("Cleanup Old Webhooks", err);
    return 0;
  }
}
