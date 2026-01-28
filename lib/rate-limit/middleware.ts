/**
 * Rate Limit Middleware for API Routes
 *
 * Spec Reference: Part 20, Lines 2130-2186
 *
 * Provides easy-to-use middleware wrappers for Next.js API routes.
 *
 * IMPORTANT: If Redis is unavailable, this middleware falls back to in-memory
 * rate limiting with degraded (stricter) limits to prevent abuse. All Redis
 * failures are logged for monitoring.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  rateLimitExceededResponse,
  addRateLimitHeaders,
  type RateLimiterType,
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
 * Validate IP address format (basic validation for IPv4 and IPv6)
 */
function isValidIP(ip: string): boolean {
  // IPv4: 1.2.3.4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6: basic validation (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  if (ipv4Regex.test(ip)) {
    // Validate each octet is 0-255
    const octets = ip.split(".");
    return octets.every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  return ipv6Regex.test(ip);
}

/**
 * Get client IP address from request
 * Validates format to prevent header spoofing attacks
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) {
    // Take the first IP (client IP in standard proxy chains)
    const firstIp = forwarded.split(",")[0].trim();
    // Validate it's a proper IP format to prevent spoofing
    if (isValidIP(firstIp)) {
      return firstIp;
    }
    // If invalid format, fall through to other methods
  }

  if (realIp) {
    const trimmedIp = realIp.trim();
    if (isValidIP(trimmedIp)) {
      return trimmedIp;
    }
  }

  return "unknown";
}

/**
 * Simple hash function for rate limit identifiers
 * Uses a basic hash to avoid storing token fragments in Redis keys
 */
function hashForRateLimit(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to hex string for readable keys
  return Math.abs(hash).toString(16).padStart(8, "0");
}

/**
 * Get user ID from Supabase auth header
 * Returns a hashed identifier or falls back to IP
 */
export async function getUserId(request: NextRequest): Promise<string> {
  // Try to get user from Authorization header (Bearer token)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    // Hash the token to avoid storing sensitive data in Redis keys
    // This preserves uniqueness while protecting the actual token
    const token = authHeader.substring(7);
    const hashedToken = hashForRateLimit(token);
    return `user:${hashedToken}`;
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
        if (!secret) {
          // In production, require webhook secrets - don't silently bypass
          if (process.env.NODE_ENV === "production") {
            return new Response("Webhook secret not configured", { status: 500 });
          }
          // In development, log warning but continue (will fail verification)
          console.warn("[Webhook] RETELL_WEBHOOK_SECRET not configured");
        }
        if (secret) {
          verified = verifyRetellSignature(payload, signature, secret);
        }
        break;
      }

      case "stripe": {
        const signature = request.headers.get("stripe-signature");
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) {
          if (process.env.NODE_ENV === "production") {
            return new Response("Webhook secret not configured", { status: 500 });
          }
          console.warn("[Webhook] STRIPE_WEBHOOK_SECRET not configured");
        }
        if (secret) {
          verified = verifyStripeSignature(payload, signature, secret);
        }
        break;
      }

      case "twilio": {
        const signature = request.headers.get("x-twilio-signature");
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        if (!authToken) {
          if (process.env.NODE_ENV === "production") {
            return new Response("Webhook secret not configured", { status: 500 });
          }
          console.warn("[Webhook] TWILIO_AUTH_TOKEN not configured");
        }
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

/**
 * Wrap an AI generation API handler with rate limiting
 * 10 requests per 1 minute per user - protects expensive Claude API calls
 */
export function withAIGenerationRateLimit<T = unknown>(handler: ApiHandler<T>): ApiHandler<T> {
  return withRateLimit(handler, { type: "aiGeneration", getIdentifier: getUserId });
}

/**
 * Wrap an image generation API handler with rate limiting
 * 5 requests per 1 minute per user - protects expensive DALL-E API calls
 */
export function withImageGenerationRateLimit<T = unknown>(handler: ApiHandler<T>): ApiHandler<T> {
  return withRateLimit(handler, { type: "imageGeneration", getIdentifier: getUserId });
}

/**
 * Wrap an admin API handler with rate limiting
 * 30 requests per 1 minute per admin - protects sensitive admin operations
 */
export function withAdminRateLimit<T = unknown>(handler: ApiHandler<T>): ApiHandler<T> {
  return withRateLimit(handler, { type: "admin", getIdentifier: getUserId });
}
