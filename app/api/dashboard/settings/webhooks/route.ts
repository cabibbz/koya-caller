/**
 * Webhooks API Route
 * Manages webhook configurations for a business
 *
 * GET /api/dashboard/settings/webhooks - List all webhooks
 * POST /api/dashboard/settings/webhooks - Create a new webhook
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import {
  getWebhooksByBusinessId,
  createWebhook,
  WEBHOOK_EVENT_TYPES,
  type WebhookEventType,
} from "@/lib/db/webhooks";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// =============================================================================
// GET Handler - List all webhooks
// =============================================================================

async function handleGet(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webhooks = await getWebhooksByBusinessId(supabase as any, business.id);

    // Mask secrets in response - only show last 8 characters
    const maskedWebhooks = webhooks.map(webhook => ({
      ...webhook,
      secret: `whsec_****${webhook.secret.slice(-8)}`,
    }));

    return success(maskedWebhooks);
  } catch (error) {
    logError("Webhooks GET", error);
    return errors.internalError("Failed to fetch webhooks");
  }
}

// =============================================================================
// POST Handler - Create a new webhook
// =============================================================================

async function handlePost(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { url, events, description, isActive } = body;

    // Validate URL
    if (!url || typeof url !== "string") {
      return errors.badRequest("URL is required");
    }

    // Validate URL format and prevent SSRF
    try {
      const parsedUrl = new URL(url);

      // Only allow HTTPS in production
      if (process.env.NODE_ENV === "production" && parsedUrl.protocol !== "https:") {
        return errors.badRequest("HTTPS is required for webhook URLs in production");
      }

      // Block private/internal hostnames (SSRF prevention)
      const hostname = parsedUrl.hostname.toLowerCase();
      const blockedPatterns = [
        /^localhost$/,
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
        /^192\.168\./,
        /^0\./,
        /^169\.254\./,  // Link-local
        /^::1$/,        // IPv6 localhost
        /^fc00:/,       // IPv6 private
        /^fe80:/,       // IPv6 link-local
        /\.local$/,     // mDNS
        /\.internal$/,  // Internal domains
      ];

      if (blockedPatterns.some(pattern => pattern.test(hostname))) {
        return errors.badRequest("Webhook URL cannot point to private or internal addresses");
      }
    } catch {
      return errors.badRequest("Invalid URL format. Must be a valid URL starting with http:// or https://");
    }

    // Validate events
    if (!events || !Array.isArray(events) || events.length === 0) {
      return errors.badRequest("At least one event type is required");
    }

    // Validate each event type
    const invalidEvents = events.filter(
      (event: string) => !WEBHOOK_EVENT_TYPES.includes(event as WebhookEventType)
    );
    if (invalidEvents.length > 0) {
      return errors.badRequest(`Invalid event types: ${invalidEvents.join(", ")}`);
    }

    // Check webhook limit (max 10 per business)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingWebhooks = await getWebhooksByBusinessId(supabase as any, business.id);
    if (existingWebhooks.length >= 10) {
      return errors.badRequest("Maximum webhook limit (10) reached");
    }

    // Create webhook - secret is auto-generated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webhook = await createWebhook(supabase as any, {
      business_id: business.id,
      url,
      events: events as WebhookEventType[],
      description: description || null,
      is_active: isActive !== false, // Default to active
    });

    return success({
      ...webhook,
      message: "Webhook created successfully. Save the secret - it won't be shown again.",
    });
  } catch (error) {
    logError("Webhooks POST", error);
    return errors.internalError("Failed to create webhook");
  }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
