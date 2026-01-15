/**
 * Rate Limit Middleware for API Routes
 * 
 * Spec Reference: Part 20, Lines 2130-2186
 * 
 * Provides easy-to-use middleware wrappers for Next.js API routes.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitExceededResponse,
  addRateLimitHeaders,
  type RateLimiterType,
  type RateLimitResult,
} from "./index";
import {
  verifyRetellSignature,
  verifyStripeSignature,
  verifyTwilioSignature,
} from "./webhook-verify";

// =============================================================================
// Types
// =============================================================================

export type ApiHandler<T = unknown> = (
  request: NextRequest,
  context?: T
) => Promise<Response> | Response;

export interface RateLimitMiddlewareOptions {
  /** Type of rate limiter to use */
  type: RateLimiterType;
  /** Function to extract identifier from request (default: IP address) */
  getIdentifier?: (request: NextRequest) => string | Promise<string>;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

/**
 * Get user ID from Supabase auth header
 * Returns the user ID or falls back to IP
 */
export async function getUserId(request: NextRequest): Promise<string> {
  // Try to get user from Authorization header (Bearer token)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    // In a real implementation, you'd verify the JWT and extract the user ID
    // For now, we'll use the token as the identifier (it's unique per user)
    const token = authHeader.substring(7);
    // Use first 32 chars of token as identifier to keep Redis keys reasonable
    return `user:${token.substring(0, 32)}`;
  }

  // Fall back to IP
  return getClientIP(request);
}

// =============================================================================
// Rate Limit Middleware
// =============================================================================

/**
 * Create a rate-limited API handler
 * 
 * @example
 * // For IP-based rate limiting (public API)
 * export const POST = withRateLimit(
 *   async (request) => {
 *     // Your handler logic
 *     return NextResponse.json({ success: true });
 *   },
 *   { type: "public" }
 * );
 * 
 * @example
 * // For user-based rate limiting (dashboard API)
 * export const GET = withRateLimit(
 *   async (request) => {
 *     return NextResponse.json({ data: [] });
 *   },
 *   { type: "dashboard", getIdentifier: getUserId }
 * );
 */
export function withRateLimit<T = unknown>(
  handler: ApiHandler<T>,
  options: RateLimitMiddlewareOptions
): ApiHandler<T> {
  return async (request: NextRequest, context?: T): Promise<Response> => {
    const { type, getIdentifier = getClientIP } = options;

    // Get identifier
    const identifier =
      typeof getIdentifier === "function"
        ? await Promise.resolve(getIdentifier(request))
        : getClientIP(request);

    // Check rate limit
    const result = await checkRateLimit(type, identifier);

    if (!result.success) {
      return rateLimitExceededResponse(result);
    }

    // Call the actual handler
    const response = await handler(request, context);

    // Add rate limit headers to response
    if (response instanceof NextResponse) {
      addRateLimitHeaders(response.headers, result);
    }

    return response;
  };
}

// =============================================================================
// Webhook Middleware
// =============================================================================

export interface WebhookMiddlewareOptions {
  /** Which webhook provider */
  provider: "retell" | "stripe" | "twilio";
  /** Apply rate limiting */
  rateLimit?: boolean;
}

/**
 * Create a webhook handler with signature verification and optional rate limiting
 * 
 * @example
 * export const POST = withWebhook(
 *   async (request, { payload }) => {
 *     const event = JSON.parse(payload);
 *     // Process webhook
 *     return NextResponse.json({ received: true });
 *   },
 *   { provider: "retell", rateLimit: true }
 * );
 */
export function withWebhook(
  handler: (
    request: NextRequest,
    context: { payload: string; verified: boolean }
  ) => Promise<Response> | Response,
  options: WebhookMiddlewareOptions
): ApiHandler {
  return async (request: NextRequest): Promise<Response> => {
    const { provider, rateLimit = true } = options;

    // Rate limit check (if enabled)
    if (rateLimit) {
      const result = await checkRateLimit("webhook", "global");
      if (!result.success) {
        return rateLimitExceededResponse(result);
      }
    }

    // Get raw payload
    const payload = await request.text();

    // Verify signature based on provider
    let verified = false;

    switch (provider) {
      case "retell": {
        const signature = request.headers.get("x-retell-signature");
        const secret = process.env.RETELL_WEBHOOK_SECRET;
        if (secret) {
          verified = verifyRetellSignature(payload, signature, secret);
        }
        break;
      }

      case "stripe": {
        const signature = request.headers.get("stripe-signature");
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (secret) {
          verified = verifyStripeSignature(payload, signature, secret);
        }
        break;
      }

      case "twilio": {
        const signature = request.headers.get("x-twilio-signature");
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const url = request.url;
        if (authToken) {
          // For Twilio, we need to parse form data
          const params: Record<string, string> = {};
          const formData = new URLSearchParams(payload);
          formData.forEach((value, key) => {
            params[key] = value;
          });
          verified = verifyTwilioSignature(url, params, signature, authToken);
        }
        break;
      }
    }

    // Require valid signature unless explicitly bypassed for local development
    // WEBHOOK_SIGNATURE_BYPASS should ONLY be set in local development
    const allowBypass = process.env.WEBHOOK_SIGNATURE_BYPASS === "true" &&
                        process.env.NODE_ENV !== "production";

    if (!verified && !allowBypass) {
      return new Response("Invalid signature", { status: 401 });
    }

    // Call the actual handler
    return handler(request, { payload, verified });
  };
}

// =============================================================================
// Convenience Wrappers
// =============================================================================

/**
 * Wrap a public API handler with rate limiting
 * Spec Line 2140: 30 requests per 1 min per IP
 */
export function withPublicRateLimit<T = unknown>(handler: ApiHandler<T>): ApiHandler<T> {
  return withRateLimit(handler, { type: "public" });
}

/**
 * Wrap a dashboard API handler with rate limiting
 * Spec Line 2139: 60 requests per 1 min per user
 */
export function withDashboardRateLimit<T = unknown>(handler: ApiHandler<T>): ApiHandler<T> {
  return withRateLimit(handler, { type: "dashboard", getIdentifier: getUserId });
}

/**
 * Wrap a demo API handler with rate limiting
 * Spec Line 2141: 3 requests per 1 hour per IP
 */
export function withDemoRateLimit<T = unknown>(handler: ApiHandler<T>): ApiHandler<T> {
  return withRateLimit(handler, { type: "demo" });
}
