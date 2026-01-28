/**
 * Webhook Delivery Retry Route
 * Manually retry a failed webhook delivery
 *
 * POST /api/dashboard/settings/webhooks/[id]/deliveries/[deliveryId]/retry
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import {
  getWebhookById,
  getWebhookDeliveryById,
} from "@/lib/db/webhooks";
import { retryWebhookDelivery } from "@/lib/webhooks/dispatcher";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; deliveryId: string }> };

// =============================================================================
// POST Handler - Retry a failed webhook delivery
// =============================================================================

async function handlePost(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext,
  context?: RouteContext
) {
  try {
    if (!context) {
      return errors.badRequest("Invalid request");
    }
    const { id: webhookId, deliveryId } = await context.params;

    // Get webhook and verify ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webhook = await getWebhookById(supabase as any, webhookId);
    if (!webhook) {
      return errors.notFound("Webhook");
    }

    if (webhook.business_id !== business.id) {
      return errors.notFound("Webhook");
    }

    // Get the delivery
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delivery = await getWebhookDeliveryById(supabase as any, deliveryId);
    if (!delivery) {
      return errors.notFound("Delivery");
    }

    // Verify delivery belongs to this webhook
    if (delivery.webhook_id !== webhookId) {
      return errors.notFound("Delivery");
    }

    // Only allow retry of failed or retrying deliveries
    if (delivery.status !== "failed" && delivery.status !== "retrying") {
      return errors.badRequest("Only failed or pending deliveries can be retried");
    }

    // Attempt retry
    const result = await retryWebhookDelivery(delivery);

    if (result.success) {
      return success({ message: "Webhook delivery retried successfully" });
    }

    return errors.internalError(result.error || "Retry failed");
  } catch (error) {
    logError("Webhook Delivery Retry POST", error);
    return errors.internalError("Failed to retry webhook delivery");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const POST = withAuth(handlePost as any);
