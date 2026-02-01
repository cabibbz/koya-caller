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
 *
 * IMPORTANT: If Redis is unavailable, the system falls back to in-memory
 * rate limiting with DEGRADED (stricter) limits to prevent abuse during
 * Redis outages. All Redis failures are logged.
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

/**
 * AI generation rate limiter (Claude API calls)
 * 10 requests per 1 minute per user - protects expensive AI endpoints
 */
export const aiGenerationLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(10, "1 m"),
      prefix: "ratelimit:ai-generation",
      analytics: true,
    })
  : null;

/**
 * Image generation rate limiter (DALL-E API calls)
 * 5 requests per 1 minute per user - protects expensive image generation
 */
export const imageGenerationLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(5, "1 m"),
      prefix: "ratelimit:image-generation",
      analytics: true,
    })
  : null;

/**
 * Admin rate limiter
 * 30 requests per 1 minute per admin - protects sensitive admin operations
 */
export const adminLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(30, "1 m"),
      prefix: "ratelimit:admin",
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
  aiGeneration: aiGenerationLimiter,
  imageGeneration: imageGenerationLimiter,
  admin: adminLimiter,
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
// In-Memory Fallback (for development without Redis OR Redis failures)
// =============================================================================

interface InMemoryRecord {
  count: number;
  resetAt: number;
}

const inMemoryStore = new Map<string, InMemoryRecord>();

// Maximum size for in-memory store to prevent unbounded growth during Redis outage
const MAX_STORE_SIZE = 10000;

// Cleanup tracking for memory leak prevention
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60 * 1000; // Clean up every minute

// Track Redis failure state for logging (avoid log spam)
let redisFailureLogged = false;
let lastRedisFailureTime = 0;
const REDIS_FAILURE_LOG_COOLDOWN_MS = 60 * 1000; // Only log once per minute

// Normal limits (when Redis is available)
const LIMITS: Record<RateLimiterType, { max: number; windowMs: number }> = {
  auth: { max: 5, windowMs: 15 * 1000 },
  passwordReset: { max: 3, windowMs: 60 * 60 * 1000 },
  webhook: { max: 100, windowMs: 60 * 1000 },
  dashboard: { max: 60, windowMs: 60 * 1000 },
  public: { max: 30, windowMs: 60 * 1000 },
  demo: { max: 3, windowMs: 60 * 60 * 1000 },
  aiGeneration: { max: 10, windowMs: 60 * 1000 },
  imageGeneration: { max: 5, windowMs: 60 * 1000 },
  admin: { max: 30, windowMs: 60 * 1000 },
};

// DEGRADED limits (stricter - when Redis is unavailable)
// These are more restrictive to prevent abuse during Redis outages
const DEGRADED_LIMITS: Record<RateLimiterType, { max: number; windowMs: number }> = {
  auth: { max: 3, windowMs: 30 * 1000 },           // 3 per 30s (stricter)
  passwordReset: { max: 2, windowMs: 60 * 60 * 1000 }, // 2 per hour (stricter)
  webhook: { max: 50, windowMs: 60 * 1000 },       // 50 per min (stricter)
  dashboard: { max: 30, windowMs: 60 * 1000 },     // 30 per min (stricter)
  public: { max: 15, windowMs: 60 * 1000 },        // 15 per min (stricter)
  demo: { max: 2, windowMs: 60 * 60 * 1000 },      // 2 per hour (stricter)
  aiGeneration: { max: 5, windowMs: 60 * 1000 },   // 5 per min (stricter)
  imageGeneration: { max: 3, windowMs: 60 * 1000 }, // 3 per min (stricter)
  admin: { max: 15, windowMs: 60 * 1000 },         // 15 per min (stricter)
};

/**
 * Evict oldest entries when store exceeds MAX_STORE_SIZE
 * Removes entries with the oldest resetAt times first
 */
function evictOldestEntries(): void {
  if (inMemoryStore.size <= MAX_STORE_SIZE) return;

  // Sort entries by resetAt (oldest first) and remove excess
  const entries = Array.from(inMemoryStore.entries())
    .sort((a, b) => a[1].resetAt - b[1].resetAt);

  const toRemove = entries.slice(0, inMemoryStore.size - MAX_STORE_SIZE + 1000); // Remove extra 1000 to avoid frequent evictions
  toRemove.forEach(([key]) => inMemoryStore.delete(key));

  // eslint-disable-next-line no-console
  console.warn(`[Rate Limit] Evicted ${toRemove.length} oldest entries due to store size limit (${MAX_STORE_SIZE})`);
}

/**
 * Clean up expired entries from in-memory store to prevent memory leaks
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;

  lastCleanup = now;
  let cleanedCount = 0;
  Array.from(inMemoryStore.entries()).forEach(([key, record]) => {
    // Remove entries that are well past their window (2x to be safe)
    if (now > record.resetAt + 60000) {
      inMemoryStore.delete(key);
      cleanedCount++;
    }
  });

  // Log if we cleaned up a significant number of entries (potential memory pressure)
  if (cleanedCount > 100) {
    // eslint-disable-next-line no-console
    console.warn(`[Rate Limit] Cleaned up ${cleanedCount} expired in-memory entries`);
  }

  // Also check if store is too large and evict if needed
  evictOldestEntries();
}

/**
 * Log Redis failure (with cooldown to prevent log spam)
 */
function logRedisFailure(error: unknown): void {
  const now = Date.now();
  if (!redisFailureLogged || (now - lastRedisFailureTime > REDIS_FAILURE_LOG_COOLDOWN_MS)) {
    // eslint-disable-next-line no-console
    console.error("[Rate Limit] Redis unavailable, using degraded in-memory fallback", {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    redisFailureLogged = true;
    lastRedisFailureTime = now;
  }
}

/**
 * In-memory rate limiting fallback
 * @param type - Rate limiter type
 * @param identifier - Unique identifier (IP, user ID, etc.)
 * @param degraded - Whether to use degraded (stricter) limits
 */
function inMemoryRateLimit(
  type: RateLimiterType,
  identifier: string,
  degraded: boolean = false
): RateLimitResult {
  // Clean up expired entries periodically
  cleanupExpiredEntries();

  // Use degraded limits if Redis failed, normal limits otherwise
  const limits = degraded ? DEGRADED_LIMITS : LIMITS;
  const { max, windowMs } = limits[type];
  const key = `${type}:${identifier}`;
  const now = Date.now();

  const record = inMemoryStore.get(key);

  if (!record || now > record.resetAt) {
    // Evict oldest entries if store is at capacity before adding new entry
    if (inMemoryStore.size >= MAX_STORE_SIZE) {
      evictOldestEntries();
    }
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
 * IMPORTANT: If Redis is unavailable, this function falls back to in-memory
 * rate limiting with DEGRADED (stricter) limits. This ensures rate limiting
 * never fails open (allowing unlimited requests).
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

  // Use in-memory fallback if Redis not configured (development mode)
  // Use normal limits since this is expected behavior
  if (!limiter) {
    return inMemoryRateLimit(type, identifier, false);
  }

  try {
    const result = await limiter.limit(identifier);

    // Reset Redis failure tracking on success
    if (redisFailureLogged) {
      // eslint-disable-next-line no-console
      console.log("[Rate Limit] Redis connection restored");
      redisFailureLogged = false;
    }

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
      retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
    };
  } catch (error) {
    // CRITICAL: If Redis fails, fall back to in-memory rate limiting with DEGRADED limits
    // This ensures rate limiting NEVER fails open (which would allow unlimited requests)
    logRedisFailure(error);

    // Use DEGRADED (stricter) limits when Redis is unavailable
    // This is more restrictive than normal to prevent abuse during outages
    return inMemoryRateLimit(type, identifier, true);
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
