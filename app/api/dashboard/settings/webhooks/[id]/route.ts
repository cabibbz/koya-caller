/**
 * Single Webhook API Route
 * Manages individual webhook operations
 *
 * GET /api/dashboard/settings/webhooks/[id] - Get webhook details with deliveries
 * PATCH /api/dashboard/settings/webhooks/[id] - Update webhook
 * DELETE /api/dashboard/settings/webhooks/[id] - Delete webhook
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
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveries,
  getWebhookStats,
  WEBHOOK_EVENT_TYPES,
  type WebhookEventType,
} from "@/lib/db/webhooks";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// =============================================================================
// GET Handler - Get webhook details including recent deliveries
// =============================================================================

async function handleGet(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext,
  context?: RouteContext
) {
  try {
    if (!context) {
      return errors.badRequest("Invalid request");
    }
    const { id } = await context.params;

    // Get webhook
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webhook = await getWebhookById(supabase as any, id);
    if (!webhook) {
      return errors.notFound("Webhook");
    }

    // Verify ownership
    if (webhook.business_id !== business.id) {
      return errors.notFound("Webhook");
    }

    // Get recent deliveries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { deliveries, total } = await getWebhookDeliveries(supabase as any, id, {
      limit: 20,
    });

    // Get stats
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats = await getWebhookStats(supabase as any, id);

    // Mask secret
    const maskedWebhook = {
      ...webhook,
      secret: `whsec_****${webhook.secret.slice(-8)}`,
    };

    return success({
      webhook: maskedWebhook,
      deliveries,
      totalDeliveries: total,
      stats,
    });
  } catch (error) {
    logError("Webhook GET", error);
    return errors.internalError("Failed to fetch webhook");
  }
}

// =============================================================================
// PATCH Handler - Update webhook configuration
// =============================================================================

async function handlePatch(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext,
  context?: RouteContext
) {
  try {
    if (!context) {
      return errors.badRequest("Invalid request");
    }
    const { id } = await context.params;

    // Get webhook
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webhook = await getWebhookById(supabase as any, id);
    if (!webhook) {
      return errors.notFound("Webhook");
    }

    // Verify ownership
    if (webhook.business_id !== business.id) {
      return errors.notFound("Webhook");
    }

    const body = await request.json();
    const { url, events, description, isActive } = body;

    // Build update object
    const updates: {
      url?: string;
      events?: WebhookEventType[];
      description?: string | null;
      is_active?: boolean;
    } = {};

    // Validate and add URL if provided
    if (url !== undefined) {
      if (typeof url !== "string") {
        return errors.badRequest("Invalid URL");
      }

      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(url)) {
        return errors.badRequest("Invalid URL format. Must start with http:// or https://");
      }

      if (process.env.NODE_ENV === "production" && !url.startsWith("https://")) {
        return errors.badRequest("HTTPS is required for webhook URLs in production");
      }

      updates.url = url;
    }

    // Validate and add events if provided
    if (events !== undefined) {
      if (!Array.isArray(events) || events.length === 0) {
        return errors.badRequest("At least one event type is required");
      }

      const invalidEvents = events.filter(
        (event: string) => !WEBHOOK_EVENT_TYPES.includes(event as WebhookEventType)
      );
      if (invalidEvents.length > 0) {
        return errors.badRequest(`Invalid event types: ${invalidEvents.join(", ")}`);
      }

      updates.events = events as WebhookEventType[];
    }

    // Add description if provided
    if (description !== undefined) {
      updates.description = description || null;
    }

    // Add isActive if provided
    if (isActive !== undefined) {
      updates.is_active = Boolean(isActive);
    }

    // Update webhook
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedWebhook = await updateWebhook(supabase as any, id, updates);

    // Mask secret
    const maskedWebhook = {
      ...updatedWebhook,
      secret: `whsec_****${updatedWebhook.secret.slice(-8)}`,
    };

    return success(maskedWebhook);
  } catch (error) {
    logError("Webhook PATCH", error);
    return errors.internalError("Failed to update webhook");
  }
}

// =============================================================================
// DELETE Handler - Delete a webhook
// =============================================================================

async function handleDelete(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext,
  context?: RouteContext
) {
  try {
    if (!context) {
      return errors.badRequest("Invalid request");
    }
    const { id } = await context.params;

    // Get webhook
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webhook = await getWebhookById(supabase as any, id);
    if (!webhook) {
      return errors.notFound("Webhook");
    }

    // Verify ownership
    if (webhook.business_id !== business.id) {
      return errors.notFound("Webhook");
    }

    // Delete webhook
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteWebhook(supabase as any, id);

    return success({ message: "Webhook deleted successfully" });
  } catch (error) {
    logError("Webhook DELETE", error);
    return errors.internalError("Failed to delete webhook");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET = withAuth(handleGet as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PATCH = withAuth(handlePatch as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DELETE = withAuth(handleDelete as any);
