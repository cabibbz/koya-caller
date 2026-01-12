/**
 * Rate Limiting Infrastructure
 * 
 * Spec Reference: Part 20, Lines 2130-2186
 * 
 * Rate Limits:
 * | Endpoint              | Limit        | Window  | Scope  |
 * |-----------------------|--------------|---------|--------|
 * | Auth (login/signup)   | 5 requests   | 15 sec  | IP     |
 * | Auth (password reset) | 3 requests   | 1 hour  | IP     |
 * | Retell webhook        | 100 requests | 1 min   | Global |
 * | Dashboard API         | 60 requests  | 1 min   | User   |
 * | Public API            | 30 requests  | 1 min   | IP     |
 * | Demo call initiation  | 3 requests   | 1 hour  | IP     |
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// =============================================================================
// Redis Client
// =============================================================================

/**
 * Create Redis client for rate limiting
 * Falls back to in-memory if env vars not set (development)
 */
function createRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({
    url,
    token,
  });
}

const redis = createRedisClient();

// =============================================================================
// Rate Limiters (Spec Lines 2155-2185)
// =============================================================================

/**
 * Auth rate limiter (login/signup)
 * 5 requests per 15 seconds per IP
 */
export const authLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(5, "15 s"),
      prefix: "ratelimit:auth",
      analytics: true,
    })
  : null;

/**
 * Password reset rate limiter
 * Spec Line 2137: 3 requests per 1 hour per IP
 */
export const passwordResetLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(3, "1 h"),
      prefix: "ratelimit:password-reset",
      analytics: true,
    })
  : null;

/**
 * Webhook rate limiter (Retell, Twilio, Stripe)
 * Spec Line 2138: 100 requests per 1 min global
 */
export const webhookLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(100, "1 m"),
      prefix: "ratelimit:webhook",
      analytics: true,
    })
  : null;

/**
 * Dashboard API rate limiter
 * Spec Line 2139: 60 requests per 1 min per user
 */
export const dashboardLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(60, "1 m"),
      prefix: "ratelimit:dashboard",
      analytics: true,
    })
  : null;

/**
 * Public API rate limiter
 * Spec Line 2140: 30 requests per 1 min per IP
 */
export const publicLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(30, "1 m"),
      prefix: "ratelimit:public",
      analytics: true,
    })
  : null;

/**
 * Demo call initiation rate limiter
 * Spec Line 2141: 3 requests per 1 hour per IP
 */
export const demoLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(3, "1 h"),
      prefix: "ratelimit:demo",
      analytics: true,
    })
  : null;

// =============================================================================
// Convenience Export
// =============================================================================

export const rateLimiters = {
  auth: authLimiter,
  passwordReset: passwordResetLimiter,
  webhook: webhookLimiter,
  dashboard: dashboardLimiter,
  public: publicLimiter,
  demo: demoLimiter,
};

// =============================================================================
// Types
// =============================================================================

export type RateLimiterType = keyof typeof rateLimiters;

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

// =============================================================================
// In-Memory Fallback (for development without Redis)
// =============================================================================

interface InMemoryRecord {
  count: number;
  resetAt: number;
}

const inMemoryStore = new Map<string, InMemoryRecord>();

const LIMITS: Record<RateLimiterType, { max: number; windowMs: number }> = {
  auth: { max: 5, windowMs: 15 * 1000 },
  passwordReset: { max: 3, windowMs: 60 * 60 * 1000 },
  webhook: { max: 100, windowMs: 60 * 1000 },
  dashboard: { max: 60, windowMs: 60 * 1000 },
  public: { max: 30, windowMs: 60 * 1000 },
  demo: { max: 3, windowMs: 60 * 60 * 1000 },
};

function inMemoryRateLimit(
  type: RateLimiterType,
  identifier: string
): RateLimitResult {
  const { max, windowMs } = LIMITS[type];
  const key = `${type}:${identifier}`;
  const now = Date.now();

  const record = inMemoryStore.get(key);

  if (!record || now > record.resetAt) {
    // Start new window
    inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      success: true,
      limit: max,
      remaining: max - 1,
      reset: Math.floor((now + windowMs) / 1000),
    };
  }

  if (record.count >= max) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return {
      success: false,
      limit: max,
      remaining: 0,
      reset: Math.floor(record.resetAt / 1000),
      retryAfter,
    };
  }

  record.count++;
  return {
    success: true,
    limit: max,
    remaining: max - record.count,
    reset: Math.floor(record.resetAt / 1000),
  };
}

// =============================================================================
// Check Rate Limit Helper
// =============================================================================

/**
 * Get client IP from request headers using platform-specific headers
 *
 * Priority order (most trusted first):
 * 1. cf-connecting-ip (Cloudflare - can't be spoofed behind CF)
 * 2. x-real-ip (Vercel/nginx - set by reverse proxy)
 * 3. x-forwarded-for (first IP in chain - less reliable)
 * 4. Fallback to "unknown"
 *
 * @param headers - Request headers
 * @returns Client IP address
 */
export function getClientIP(headers: Headers): string {
  // Cloudflare - most reliable when behind CF
  const cfIP = headers.get("cf-connecting-ip");
  if (cfIP) return cfIP;

  // Vercel/nginx - reliable when set by reverse proxy
  const realIP = headers.get("x-real-ip");
  if (realIP) return realIP;

  // x-forwarded-for - use first IP (can be spoofed without proper proxy setup)
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIP = forwardedFor.split(",")[0].trim();
    if (firstIP) return firstIP;
  }

  return "unknown";
}

/**
 * Check rate limit for a given type and identifier
 *
 * @param type - The rate limiter type
 * @param identifier - The identifier (IP address, user ID, or "global")
 * @returns Rate limit result
 *
 * @example
 * const ip = getClientIP(request.headers);
 * const result = await checkRateLimit("auth", ip);
 * if (!result.success) {
 *   return new Response("Too many requests", {
 *     status: 429,
 *     headers: { "Retry-After": String(result.retryAfter) }
 *   });
 * }
 */
export async function checkRateLimit(
  type: RateLimiterType,
  identifier: string
): Promise<RateLimitResult> {
  const limiter = rateLimiters[type];

  // Use in-memory fallback if Redis not configured
  if (!limiter) {
    return inMemoryRateLimit(type, identifier);
  }

  try {
    const result = await limiter.limit(identifier);
    
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
    };
  } catch {
    // If Redis fails, allow the request (fail open)
    return {
      success: true,
      limit: LIMITS[type].max,
      remaining: LIMITS[type].max - 1,
      reset: Math.floor((Date.now() + LIMITS[type].windowMs) / 1000),
    };
  }
}

// =============================================================================
// Rate Limit Response Helper
// =============================================================================

/**
 * Create a rate limit exceeded response
 */
export function rateLimitExceededResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests",
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
        "Retry-After": String(result.retryAfter || 60),
      },
    }
  );
}

/**
 * Add rate limit headers to a response
 */
export function addRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult
): void {
  headers.set("X-RateLimit-Limit", String(result.limit));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", String(result.reset));
}
