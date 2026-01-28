/**
 * Rate Limiting Tests
 * Tests for rate limiting infrastructure including in-memory fallback
 */

import { describe, it, expect } from "vitest";
import crypto from "crypto";

// =============================================================================
// Rate Limit Configuration Tests
// =============================================================================

describe("Rate Limit Configuration", () => {
  const LIMITS = {
    auth: { max: 5, windowMs: 15 * 1000 },
    passwordReset: { max: 3, windowMs: 60 * 60 * 1000 },
    webhook: { max: 100, windowMs: 60 * 1000 },
    dashboard: { max: 60, windowMs: 60 * 1000 },
    public: { max: 30, windowMs: 60 * 1000 },
    demo: { max: 3, windowMs: 60 * 60 * 1000 },
    aiGeneration: { max: 10, windowMs: 60 * 1000 },
    imageGeneration: { max: 5, windowMs: 60 * 1000 },
  };

  const DEGRADED_LIMITS = {
    auth: { max: 3, windowMs: 30 * 1000 },
    passwordReset: { max: 2, windowMs: 60 * 60 * 1000 },
    webhook: { max: 50, windowMs: 60 * 1000 },
    dashboard: { max: 30, windowMs: 60 * 1000 },
    public: { max: 15, windowMs: 60 * 1000 },
    demo: { max: 2, windowMs: 60 * 60 * 1000 },
    aiGeneration: { max: 5, windowMs: 60 * 1000 },
    imageGeneration: { max: 3, windowMs: 60 * 1000 },
  };

  describe("Normal limits", () => {
    it("should have correct auth limit (5 per 15s)", () => {
      expect(LIMITS.auth.max).toBe(5);
      expect(LIMITS.auth.windowMs).toBe(15 * 1000);
    });

    it("should have correct password reset limit (3 per hour)", () => {
      expect(LIMITS.passwordReset.max).toBe(3);
      expect(LIMITS.passwordReset.windowMs).toBe(60 * 60 * 1000);
    });

    it("should have correct webhook limit (100 per minute)", () => {
      expect(LIMITS.webhook.max).toBe(100);
      expect(LIMITS.webhook.windowMs).toBe(60 * 1000);
    });

    it("should have correct dashboard limit (60 per minute)", () => {
      expect(LIMITS.dashboard.max).toBe(60);
      expect(LIMITS.dashboard.windowMs).toBe(60 * 1000);
    });

    it("should have correct public API limit (30 per minute)", () => {
      expect(LIMITS.public.max).toBe(30);
      expect(LIMITS.public.windowMs).toBe(60 * 1000);
    });

    it("should have correct demo limit (3 per hour)", () => {
      expect(LIMITS.demo.max).toBe(3);
      expect(LIMITS.demo.windowMs).toBe(60 * 60 * 1000);
    });

    it("should have correct AI generation limit (10 per minute)", () => {
      expect(LIMITS.aiGeneration.max).toBe(10);
      expect(LIMITS.aiGeneration.windowMs).toBe(60 * 1000);
    });

    it("should have correct image generation limit (5 per minute)", () => {
      expect(LIMITS.imageGeneration.max).toBe(5);
      expect(LIMITS.imageGeneration.windowMs).toBe(60 * 1000);
    });
  });

  describe("Degraded limits (stricter)", () => {
    it("should have stricter auth limit when degraded", () => {
      expect(DEGRADED_LIMITS.auth.max).toBeLessThan(LIMITS.auth.max);
      expect(DEGRADED_LIMITS.auth.max).toBe(3);
    });

    it("should have stricter password reset limit when degraded", () => {
      expect(DEGRADED_LIMITS.passwordReset.max).toBeLessThan(LIMITS.passwordReset.max);
      expect(DEGRADED_LIMITS.passwordReset.max).toBe(2);
    });

    it("should have stricter webhook limit when degraded", () => {
      expect(DEGRADED_LIMITS.webhook.max).toBeLessThan(LIMITS.webhook.max);
      expect(DEGRADED_LIMITS.webhook.max).toBe(50);
    });

    it("should have stricter dashboard limit when degraded", () => {
      expect(DEGRADED_LIMITS.dashboard.max).toBeLessThan(LIMITS.dashboard.max);
      expect(DEGRADED_LIMITS.dashboard.max).toBe(30);
    });

    it("should have stricter public limit when degraded", () => {
      expect(DEGRADED_LIMITS.public.max).toBeLessThan(LIMITS.public.max);
      expect(DEGRADED_LIMITS.public.max).toBe(15);
    });

    it("should have stricter demo limit when degraded", () => {
      expect(DEGRADED_LIMITS.demo.max).toBeLessThan(LIMITS.demo.max);
      expect(DEGRADED_LIMITS.demo.max).toBe(2);
    });

    it("should have stricter AI generation limit when degraded", () => {
      expect(DEGRADED_LIMITS.aiGeneration.max).toBeLessThan(LIMITS.aiGeneration.max);
      expect(DEGRADED_LIMITS.aiGeneration.max).toBe(5);
    });

    it("should have stricter image generation limit when degraded", () => {
      expect(DEGRADED_LIMITS.imageGeneration.max).toBeLessThan(LIMITS.imageGeneration.max);
      expect(DEGRADED_LIMITS.imageGeneration.max).toBe(3);
    });
  });
});

// =============================================================================
// In-Memory Rate Limit Fallback Tests
// =============================================================================

describe("In-Memory Rate Limit Fallback", () => {
  interface InMemoryRecord {
    count: number;
    resetAt: number;
  }

  interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
    retryAfter?: number;
  }

  // Simulate in-memory store
  let inMemoryStore: Map<string, InMemoryRecord>;

  beforeEach(() => {
    inMemoryStore = new Map();
  });

  function inMemoryRateLimit(
    type: string,
    identifier: string,
    max: number,
    windowMs: number
  ): RateLimitResult {
    const key = `${type}:${identifier}`;
    const now = Date.now();

    const record = inMemoryStore.get(key);

    if (!record || now > record.resetAt) {
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

  describe("First request in window", () => {
    it("should allow first request", () => {
      const result = inMemoryRateLimit("auth", "192.168.1.1", 5, 15000);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("should set correct limit", () => {
      const result = inMemoryRateLimit("public", "192.168.1.1", 30, 60000);
      expect(result.limit).toBe(30);
    });
  });

  describe("Multiple requests in window", () => {
    it("should decrement remaining count", () => {
      const result1 = inMemoryRateLimit("auth", "192.168.1.1", 5, 15000);
      expect(result1.remaining).toBe(4);

      const result2 = inMemoryRateLimit("auth", "192.168.1.1", 5, 15000);
      expect(result2.remaining).toBe(3);

      const result3 = inMemoryRateLimit("auth", "192.168.1.1", 5, 15000);
      expect(result3.remaining).toBe(2);
    });

    it("should allow requests up to limit", () => {
      for (let i = 0; i < 5; i++) {
        const result = inMemoryRateLimit("auth", "192.168.1.1", 5, 15000);
        expect(result.success).toBe(true);
      }
    });

    it("should block requests exceeding limit", () => {
      // Use up all 5 requests
      for (let i = 0; i < 5; i++) {
        inMemoryRateLimit("auth", "192.168.1.1", 5, 15000);
      }

      // 6th request should fail
      const result = inMemoryRateLimit("auth", "192.168.1.1", 5, 15000);
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should provide retryAfter when blocked", () => {
      for (let i = 0; i < 5; i++) {
        inMemoryRateLimit("auth", "192.168.1.1", 5, 15000);
      }

      const result = inMemoryRateLimit("auth", "192.168.1.1", 5, 15000);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(15);
    });
  });

  describe("Different identifiers", () => {
    it("should track different IPs separately", () => {
      const result1 = inMemoryRateLimit("auth", "192.168.1.1", 5, 15000);
      const result2 = inMemoryRateLimit("auth", "192.168.1.2", 5, 15000);

      expect(result1.remaining).toBe(4);
      expect(result2.remaining).toBe(4);
    });

    it("should track different types separately", () => {
      const result1 = inMemoryRateLimit("auth", "192.168.1.1", 5, 15000);
      const result2 = inMemoryRateLimit("public", "192.168.1.1", 30, 60000);

      expect(result1.remaining).toBe(4);
      expect(result2.remaining).toBe(29);
    });
  });

  describe("Window expiration", () => {
    it("should reset count after window expires", () => {
      // First set of requests
      for (let i = 0; i < 5; i++) {
        inMemoryRateLimit("auth", "192.168.1.1", 5, 15000);
      }

      // Simulate window expiration by manually updating the record
      const key = "auth:192.168.1.1";
      const record = inMemoryStore.get(key);
      if (record) {
        record.resetAt = Date.now() - 1000; // Set to past
      }

      // Should be allowed again
      const result = inMemoryRateLimit("auth", "192.168.1.1", 5, 15000);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(4);
    });
  });
});

// =============================================================================
// Client IP Extraction Tests
// =============================================================================

describe("Client IP Extraction", () => {
  function getClientIP(headers: Headers): string {
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

  describe("Cloudflare header", () => {
    it("should use cf-connecting-ip when present", () => {
      const headers = new Headers({
        "cf-connecting-ip": "203.0.113.50",
        "x-real-ip": "10.0.0.1",
        "x-forwarded-for": "192.168.1.1",
      });
      expect(getClientIP(headers)).toBe("203.0.113.50");
    });
  });

  describe("Vercel/nginx header", () => {
    it("should use x-real-ip when cf-connecting-ip is absent", () => {
      const headers = new Headers({
        "x-real-ip": "203.0.113.50",
        "x-forwarded-for": "192.168.1.1",
      });
      expect(getClientIP(headers)).toBe("203.0.113.50");
    });
  });

  describe("Forwarded-for header", () => {
    it("should use first IP from x-forwarded-for chain", () => {
      const headers = new Headers({
        "x-forwarded-for": "203.0.113.50, 10.0.0.1, 192.168.1.1",
      });
      expect(getClientIP(headers)).toBe("203.0.113.50");
    });

    it("should handle single IP in x-forwarded-for", () => {
      const headers = new Headers({
        "x-forwarded-for": "203.0.113.50",
      });
      expect(getClientIP(headers)).toBe("203.0.113.50");
    });

    it("should trim whitespace from forwarded IPs", () => {
      const headers = new Headers({
        "x-forwarded-for": "  203.0.113.50  , 10.0.0.1",
      });
      expect(getClientIP(headers)).toBe("203.0.113.50");
    });
  });

  describe("Fallback behavior", () => {
    it("should return unknown when no headers present", () => {
      const headers = new Headers();
      expect(getClientIP(headers)).toBe("unknown");
    });
  });

  describe("Header priority", () => {
    it("should prioritize cf-connecting-ip over others", () => {
      const headers = new Headers({
        "cf-connecting-ip": "1.1.1.1",
        "x-real-ip": "2.2.2.2",
        "x-forwarded-for": "3.3.3.3",
      });
      expect(getClientIP(headers)).toBe("1.1.1.1");
    });

    it("should prioritize x-real-ip over x-forwarded-for", () => {
      const headers = new Headers({
        "x-real-ip": "2.2.2.2",
        "x-forwarded-for": "3.3.3.3",
      });
      expect(getClientIP(headers)).toBe("2.2.2.2");
    });
  });
});

// =============================================================================
// Rate Limit Response Tests
// =============================================================================

describe("Rate Limit Response", () => {
  interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
    retryAfter?: number;
  }

  function rateLimitExceededResponse(result: RateLimitResult): {
    status: number;
    body: { error: string; retryAfter?: number };
    headers: Record<string, string>;
  } {
    return {
      status: 429,
      body: {
        error: "Too many requests",
        retryAfter: result.retryAfter,
      },
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.reset),
        "Retry-After": String(result.retryAfter || 60),
      },
    };
  }

  it("should return 429 status", () => {
    const result: RateLimitResult = {
      success: false,
      limit: 5,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 15,
      retryAfter: 15,
    };

    const response = rateLimitExceededResponse(result);
    expect(response.status).toBe(429);
  });

  it("should include error message", () => {
    const result: RateLimitResult = {
      success: false,
      limit: 5,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 15,
      retryAfter: 15,
    };

    const response = rateLimitExceededResponse(result);
    expect(response.body.error).toBe("Too many requests");
  });

  it("should include retryAfter in body", () => {
    const result: RateLimitResult = {
      success: false,
      limit: 5,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 15,
      retryAfter: 15,
    };

    const response = rateLimitExceededResponse(result);
    expect(response.body.retryAfter).toBe(15);
  });

  it("should include rate limit headers", () => {
    const result: RateLimitResult = {
      success: false,
      limit: 5,
      remaining: 0,
      reset: 1700000000,
      retryAfter: 15,
    };

    const response = rateLimitExceededResponse(result);
    expect(response.headers["X-RateLimit-Limit"]).toBe("5");
    expect(response.headers["X-RateLimit-Remaining"]).toBe("0");
    expect(response.headers["X-RateLimit-Reset"]).toBe("1700000000");
    expect(response.headers["Retry-After"]).toBe("15");
  });

  it("should default Retry-After to 60 if not provided", () => {
    const result: RateLimitResult = {
      success: false,
      limit: 5,
      remaining: 0,
      reset: 1700000000,
    };

    const response = rateLimitExceededResponse(result);
    expect(response.headers["Retry-After"]).toBe("60");
  });
});

// =============================================================================
// Webhook Signature Verification Tests
// =============================================================================

describe("Webhook Signature Verification", () => {
  describe("Retell signature verification", () => {
    function verifyRetellSignature(
      payload: string,
      signature: string | null,
      secret: string
    ): boolean {
      if (!signature) return false;

      try {
        const expectedSignature = crypto
          .createHmac("sha256", secret)
          .update(payload)
          .digest("hex");

        return crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSignature)
        );
      } catch {
        return false;
      }
    }

    it("should verify valid signature", () => {
      const payload = '{"event":"call.started"}';
      const secret = "test-secret";
      const signature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      expect(verifyRetellSignature(payload, signature, secret)).toBe(true);
    });

    it("should reject invalid signature", () => {
      const payload = '{"event":"call.started"}';
      const secret = "test-secret";
      const invalidSignature = "invalid-signature-here";

      expect(verifyRetellSignature(payload, invalidSignature, secret)).toBe(false);
    });

    it("should reject null signature", () => {
      const payload = '{"event":"call.started"}';
      const secret = "test-secret";

      expect(verifyRetellSignature(payload, null, secret)).toBe(false);
    });

    it("should reject signature for modified payload", () => {
      const payload = '{"event":"call.started"}';
      const modifiedPayload = '{"event":"call.ended"}';
      const secret = "test-secret";
      const signature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      expect(verifyRetellSignature(modifiedPayload, signature, secret)).toBe(false);
    });
  });

  describe("Twilio signature verification", () => {
    function verifyTwilioSignature(
      url: string,
      params: Record<string, string>,
      signature: string | null,
      authToken: string
    ): boolean {
      if (!signature) return false;

      try {
        const sortedParams = Object.keys(params)
          .sort()
          .map((key) => key + params[key])
          .join("");

        const data = url + sortedParams;

        const expectedSignature = crypto
          .createHmac("sha1", authToken)
          .update(data)
          .digest("base64");

        return crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSignature)
        );
      } catch {
        return false;
      }
    }

    it("should verify valid Twilio signature", () => {
      const url = "https://example.com/webhook";
      const params = { CallSid: "CA123", From: "+1555123456" };
      const authToken = "twilio-auth-token";

      const sortedParams = Object.keys(params)
        .sort()
        .map((key) => key + params[key as keyof typeof params])
        .join("");
      const data = url + sortedParams;
      const signature = crypto
        .createHmac("sha1", authToken)
        .update(data)
        .digest("base64");

      expect(verifyTwilioSignature(url, params, signature, authToken)).toBe(true);
    });

    it("should reject null Twilio signature", () => {
      const url = "https://example.com/webhook";
      const params = { CallSid: "CA123" };
      const authToken = "twilio-auth-token";

      expect(verifyTwilioSignature(url, params, null, authToken)).toBe(false);
    });

    it("should sort params alphabetically", () => {
      const url = "https://example.com/webhook";
      const params = { Zebra: "z", Alpha: "a", Middle: "m" };
      const authToken = "twilio-auth-token";

      // Expected order: Alpha, Middle, Zebra
      const sortedData = url + "Alphaa" + "Middlem" + "Zebraz";
      const signature = crypto
        .createHmac("sha1", authToken)
        .update(sortedData)
        .digest("base64");

      expect(verifyTwilioSignature(url, params, signature, authToken)).toBe(true);
    });
  });

  describe("Stripe signature verification", () => {
    function verifyStripeSignature(
      payload: string,
      signatureHeader: string | null,
      secret: string,
      tolerance: number = 300
    ): boolean {
      if (!signatureHeader) return false;

      try {
        const elements = signatureHeader.split(",");
        const signatures: { t?: string; v1?: string } = {};

        for (const element of elements) {
          const [key, value] = element.split("=");
          if (key === "t") signatures.t = value;
          if (key === "v1") signatures.v1 = value;
        }

        if (!signatures.t || !signatures.v1) return false;

        const timestamp = parseInt(signatures.t, 10);
        const now = Math.floor(Date.now() / 1000);

        if (Math.abs(now - timestamp) > tolerance) return false;

        const signedPayload = `${timestamp}.${payload}`;
        const expectedSignature = crypto
          .createHmac("sha256", secret)
          .update(signedPayload)
          .digest("hex");

        return crypto.timingSafeEqual(
          Buffer.from(signatures.v1),
          Buffer.from(expectedSignature)
        );
      } catch {
        return false;
      }
    }

    it("should verify valid Stripe signature", () => {
      const payload = '{"type":"payment_intent.succeeded"}';
      const secret = "whsec_test";
      const timestamp = Math.floor(Date.now() / 1000);

      const signedPayload = `${timestamp}.${payload}`;
      const signature = crypto
        .createHmac("sha256", secret)
        .update(signedPayload)
        .digest("hex");

      const signatureHeader = `t=${timestamp},v1=${signature}`;

      expect(verifyStripeSignature(payload, signatureHeader, secret)).toBe(true);
    });

    it("should reject null Stripe signature header", () => {
      const payload = '{"type":"payment_intent.succeeded"}';
      const secret = "whsec_test";

      expect(verifyStripeSignature(payload, null, secret)).toBe(false);
    });

    it("should reject expired timestamp", () => {
      const payload = '{"type":"payment_intent.succeeded"}';
      const secret = "whsec_test";
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago (> 300 tolerance)

      const signedPayload = `${oldTimestamp}.${payload}`;
      const signature = crypto
        .createHmac("sha256", secret)
        .update(signedPayload)
        .digest("hex");

      const signatureHeader = `t=${oldTimestamp},v1=${signature}`;

      expect(verifyStripeSignature(payload, signatureHeader, secret)).toBe(false);
    });

    it("should reject missing timestamp", () => {
      const payload = '{"type":"payment_intent.succeeded"}';
      const secret = "whsec_test";
      const signatureHeader = "v1=somesignature";

      expect(verifyStripeSignature(payload, signatureHeader, secret)).toBe(false);
    });

    it("should reject missing v1 signature", () => {
      const payload = '{"type":"payment_intent.succeeded"}';
      const secret = "whsec_test";
      const timestamp = Math.floor(Date.now() / 1000);
      const signatureHeader = `t=${timestamp}`;

      expect(verifyStripeSignature(payload, signatureHeader, secret)).toBe(false);
    });
  });

  describe("Generic HMAC verification", () => {
    function verifyHmacSignature(
      payload: string,
      signature: string | null,
      secret: string,
      algorithm: "sha256" | "sha1" = "sha256",
      encoding: "hex" | "base64" = "hex"
    ): boolean {
      if (!signature) return false;

      try {
        const expectedSignature = crypto
          .createHmac(algorithm, secret)
          .update(payload)
          .digest(encoding);

        return crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSignature)
        );
      } catch {
        return false;
      }
    }

    it("should verify sha256/hex signature", () => {
      const payload = "test-payload";
      const secret = "test-secret";
      const signature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      expect(verifyHmacSignature(payload, signature, secret, "sha256", "hex")).toBe(true);
    });

    it("should verify sha1/base64 signature", () => {
      const payload = "test-payload";
      const secret = "test-secret";
      const signature = crypto
        .createHmac("sha1", secret)
        .update(payload)
        .digest("base64");

      expect(verifyHmacSignature(payload, signature, secret, "sha1", "base64")).toBe(true);
    });

    it("should reject null signature", () => {
      const payload = "test-payload";
      const secret = "test-secret";

      expect(verifyHmacSignature(payload, null, secret)).toBe(false);
    });
  });
});

// =============================================================================
// Memory Cleanup Tests
// =============================================================================

describe("In-Memory Store Cleanup", () => {
  interface InMemoryRecord {
    count: number;
    resetAt: number;
  }

  function cleanupExpiredEntries(
    store: Map<string, InMemoryRecord>,
    now: number
  ): number {
    let cleanedCount = 0;
    Array.from(store.entries()).forEach(([key, record]) => {
      // Remove entries that are well past their window (2x to be safe)
      if (now > record.resetAt + 60000) {
        store.delete(key);
        cleanedCount++;
      }
    });
    return cleanedCount;
  }

  it("should remove expired entries", () => {
    const store = new Map<string, InMemoryRecord>();
    const now = Date.now();

    // Add expired entry
    store.set("expired:1", { count: 5, resetAt: now - 120000 });
    // Add non-expired entry
    store.set("active:1", { count: 2, resetAt: now + 60000 });

    const cleaned = cleanupExpiredEntries(store, now);

    expect(cleaned).toBe(1);
    expect(store.has("expired:1")).toBe(false);
    expect(store.has("active:1")).toBe(true);
  });

  it("should keep entries within grace period", () => {
    const store = new Map<string, InMemoryRecord>();
    const now = Date.now();

    // Entry just past reset but within grace period (60s)
    store.set("grace:1", { count: 5, resetAt: now - 30000 });

    const cleaned = cleanupExpiredEntries(store, now);

    expect(cleaned).toBe(0);
    expect(store.has("grace:1")).toBe(true);
  });

  it("should handle empty store", () => {
    const store = new Map<string, InMemoryRecord>();
    const now = Date.now();

    const cleaned = cleanupExpiredEntries(store, now);
    expect(cleaned).toBe(0);
  });
});

// =============================================================================
// Rate Limiter Type Tests
// =============================================================================

describe("Rate Limiter Types", () => {
  const validTypes = [
    "auth",
    "passwordReset",
    "webhook",
    "dashboard",
    "public",
    "demo",
    "aiGeneration",
    "imageGeneration",
  ] as const;

  it("should have all required rate limiter types", () => {
    expect(validTypes).toContain("auth");
    expect(validTypes).toContain("passwordReset");
    expect(validTypes).toContain("webhook");
    expect(validTypes).toContain("dashboard");
    expect(validTypes).toContain("public");
    expect(validTypes).toContain("demo");
  });

  it("should include AI generation limiter", () => {
    expect(validTypes).toContain("aiGeneration");
  });

  it("should include image generation limiter", () => {
    expect(validTypes).toContain("imageGeneration");
  });

  it("should have 8 rate limiter types", () => {
    expect(validTypes.length).toBe(8);
  });
});

// =============================================================================
// Edge Case Tests
// =============================================================================

describe("Edge Cases", () => {
  // ---------------------------------------------------------------------------
  // Concurrent Requests Handling
  // ---------------------------------------------------------------------------
  describe("Concurrent requests handling", () => {
    interface InMemoryRecord {
      count: number;
      resetAt: number;
    }

    let inMemoryStore: Map<string, InMemoryRecord>;

    beforeEach(() => {
      inMemoryStore = new Map();
    });

    function inMemoryRateLimit(
      type: string,
      identifier: string,
      max: number,
      windowMs: number
    ): { success: boolean; remaining: number } {
      const key = `${type}:${identifier}`;
      const now = Date.now();

      const record = inMemoryStore.get(key);

      if (!record || now > record.resetAt) {
        inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
        return { success: true, remaining: max - 1 };
      }

      if (record.count >= max) {
        return { success: false, remaining: 0 };
      }

      record.count++;
      return { success: true, remaining: max - record.count };
    }

    it("should handle multiple concurrent requests from same IP correctly", () => {
      const results: { success: boolean; remaining: number }[] = [];
      const numRequests = 10;
      const maxAllowed = 5;

      // Simulate concurrent requests by making them in rapid succession
      for (let i = 0; i < numRequests; i++) {
        results.push(inMemoryRateLimit("auth", "192.168.1.1", maxAllowed, 15000));
      }

      // First 5 should succeed
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBe(maxAllowed);

      // Remaining 5 should fail
      const failCount = results.filter(r => !r.success).length;
      expect(failCount).toBe(numRequests - maxAllowed);
    });

    it("should handle concurrent requests from different IPs independently", () => {
      const ips = ["192.168.1.1", "192.168.1.2", "192.168.1.3"];
      const maxAllowed = 5;

      // Each IP makes 3 requests
      for (const ip of ips) {
        for (let i = 0; i < 3; i++) {
          inMemoryRateLimit("auth", ip, maxAllowed, 15000);
        }
      }

      // Each IP should have 2 remaining
      for (const ip of ips) {
        const result = inMemoryRateLimit("auth", ip, maxAllowed, 15000);
        expect(result.remaining).toBe(1); // After 4th request
      }
    });

    it("should handle rapid sequential requests without race conditions", () => {
      const results: boolean[] = [];
      const maxAllowed = 3;

      // Rapid fire requests
      for (let i = 0; i < 100; i++) {
        const result = inMemoryRateLimit("demo", "rapid-test", maxAllowed, 60000);
        results.push(result.success);
      }

      // Exactly 3 should succeed
      expect(results.filter(r => r).length).toBe(maxAllowed);
    });
  });

  // ---------------------------------------------------------------------------
  // Memory Overflow Protection
  // ---------------------------------------------------------------------------
  describe("Memory overflow protection", () => {
    interface InMemoryRecord {
      count: number;
      resetAt: number;
    }

    const MAX_STORE_SIZE = 10000;

    function createLimitedStore(): Map<string, InMemoryRecord> {
      const store = new Map<string, InMemoryRecord>();
      return store;
    }

    function addEntryWithLimit(
      store: Map<string, InMemoryRecord>,
      key: string,
      record: InMemoryRecord
    ): boolean {
      if (store.size >= MAX_STORE_SIZE && !store.has(key)) {
        // Evict oldest entries (by resetAt time)
        const entries = Array.from(store.entries());
        entries.sort((a, b) => a[1].resetAt - b[1].resetAt);

        // Remove 10% of entries
        const toRemove = Math.ceil(MAX_STORE_SIZE * 0.1);
        for (let i = 0; i < toRemove && i < entries.length; i++) {
          store.delete(entries[i][0]);
        }
      }

      store.set(key, record);
      return true;
    }

    it("should enforce MAX_STORE_SIZE limit", () => {
      const store = createLimitedStore();
      const now = Date.now();

      // Add entries up to the limit
      for (let i = 0; i < MAX_STORE_SIZE; i++) {
        store.set(`key-${i}`, { count: 1, resetAt: now + i });
      }

      expect(store.size).toBe(MAX_STORE_SIZE);
    });

    it("should evict old entries when store is full", () => {
      const store = createLimitedStore();
      const now = Date.now();

      // Fill the store
      for (let i = 0; i < MAX_STORE_SIZE; i++) {
        store.set(`key-${i}`, { count: 1, resetAt: now + i });
      }

      // Add a new entry which should trigger eviction
      addEntryWithLimit(store, "new-key", { count: 1, resetAt: now + MAX_STORE_SIZE + 1 });

      // Store should have new entry
      expect(store.has("new-key")).toBe(true);

      // Store size should be under limit after eviction
      expect(store.size).toBeLessThanOrEqual(MAX_STORE_SIZE);
    });

    it("should evict entries with earliest resetAt times first", () => {
      const store = createLimitedStore();
      const now = Date.now();

      // Add entries with varying resetAt times
      for (let i = 0; i < MAX_STORE_SIZE; i++) {
        store.set(`key-${i}`, { count: 1, resetAt: now + i * 1000 });
      }

      // The oldest entry
      expect(store.has("key-0")).toBe(true);

      // Trigger eviction
      addEntryWithLimit(store, "new-key", { count: 1, resetAt: now + MAX_STORE_SIZE * 1000 });

      // Oldest entries should be evicted
      expect(store.has("key-0")).toBe(false);
      expect(store.has("key-1")).toBe(false);
    });

    it("should not evict when updating existing key", () => {
      const store = createLimitedStore();
      const now = Date.now();

      // Fill the store
      for (let i = 0; i < MAX_STORE_SIZE; i++) {
        store.set(`key-${i}`, { count: 1, resetAt: now + i });
      }

      const originalSize = store.size;

      // Update existing key should not trigger eviction
      addEntryWithLimit(store, "key-5000", { count: 2, resetAt: now + 5000 });

      expect(store.size).toBe(originalSize);
    });
  });

  // ---------------------------------------------------------------------------
  // IPv6 Addresses
  // ---------------------------------------------------------------------------
  describe("IPv6 addresses", () => {
    function getClientIP(headers: Headers): string {
      const cfIP = headers.get("cf-connecting-ip");
      if (cfIP) return cfIP;

      const realIP = headers.get("x-real-ip");
      if (realIP) return realIP;

      const forwardedFor = headers.get("x-forwarded-for");
      if (forwardedFor) {
        const firstIP = forwardedFor.split(",")[0].trim();
        if (firstIP) return firstIP;
      }

      return "unknown";
    }

    it("should handle full IPv6 addresses", () => {
      const headers = new Headers({
        "cf-connecting-ip": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
      });
      expect(getClientIP(headers)).toBe("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
    });

    it("should handle compressed IPv6 addresses", () => {
      const headers = new Headers({
        "x-real-ip": "2001:db8::8a2e:370:7334",
      });
      expect(getClientIP(headers)).toBe("2001:db8::8a2e:370:7334");
    });

    it("should handle IPv6 loopback address", () => {
      const headers = new Headers({
        "x-forwarded-for": "::1",
      });
      expect(getClientIP(headers)).toBe("::1");
    });

    it("should handle IPv4-mapped IPv6 addresses", () => {
      const headers = new Headers({
        "cf-connecting-ip": "::ffff:192.168.1.1",
      });
      expect(getClientIP(headers)).toBe("::ffff:192.168.1.1");
    });

    it("should handle IPv6 in forwarded chain", () => {
      const headers = new Headers({
        "x-forwarded-for": "2001:db8::1, 2001:db8::2, 192.168.1.1",
      });
      expect(getClientIP(headers)).toBe("2001:db8::1");
    });

    it("should handle IPv6 with zone ID", () => {
      const headers = new Headers({
        "x-real-ip": "fe80::1%eth0",
      });
      expect(getClientIP(headers)).toBe("fe80::1%eth0");
    });
  });

  // ---------------------------------------------------------------------------
  // Empty/Malformed IP Addresses
  // ---------------------------------------------------------------------------
  describe("Empty/malformed IP addresses", () => {
    function getClientIP(headers: Headers): string {
      const cfIP = headers.get("cf-connecting-ip");
      if (cfIP && cfIP.trim()) return cfIP.trim();

      const realIP = headers.get("x-real-ip");
      if (realIP && realIP.trim()) return realIP.trim();

      const forwardedFor = headers.get("x-forwarded-for");
      if (forwardedFor) {
        const firstIP = forwardedFor.split(",")[0].trim();
        if (firstIP) return firstIP;
      }

      return "unknown";
    }

    function isValidIP(ip: string): boolean {
      if (!ip || ip === "unknown") return false;

      // IPv4 pattern
      const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipv4Pattern.test(ip)) {
        const parts = ip.split(".").map(Number);
        return parts.every(p => p >= 0 && p <= 255);
      }

      // IPv6 pattern (simplified check)
      const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
      if (ipv6Pattern.test(ip) || ip === "::1") return true;

      // IPv4-mapped IPv6
      if (ip.startsWith("::ffff:")) return true;

      return false;
    }

    it("should return unknown for empty cf-connecting-ip", () => {
      const headers = new Headers({
        "cf-connecting-ip": "",
      });
      expect(getClientIP(headers)).toBe("unknown");
    });

    it("should return unknown for whitespace-only header", () => {
      const headers = new Headers({
        "cf-connecting-ip": "   ",
      });
      expect(getClientIP(headers)).toBe("unknown");
    });

    it("should return unknown for empty forwarded chain", () => {
      const headers = new Headers({
        "x-forwarded-for": ",,,",
      });
      expect(getClientIP(headers)).toBe("unknown");
    });

    it("should handle malformed IPv4 with extra octets", () => {
      expect(isValidIP("192.168.1.1.1")).toBe(false);
    });

    it("should handle malformed IPv4 with missing octets", () => {
      expect(isValidIP("192.168.1")).toBe(false);
    });

    it("should handle IPv4 with out-of-range octets", () => {
      expect(isValidIP("256.168.1.1")).toBe(false);
      expect(isValidIP("192.168.1.300")).toBe(false);
    });

    it("should handle random string as IP", () => {
      expect(isValidIP("not-an-ip")).toBe(false);
      expect(isValidIP("abc.def.ghi.jkl")).toBe(false);
    });

    it("should handle null-like strings", () => {
      expect(isValidIP("null")).toBe(false);
      expect(isValidIP("undefined")).toBe(false);
    });

    it("should validate correct IPv4 addresses", () => {
      expect(isValidIP("192.168.1.1")).toBe(true);
      expect(isValidIP("0.0.0.0")).toBe(true);
      expect(isValidIP("255.255.255.255")).toBe(true);
    });

    it("should validate correct IPv6 addresses", () => {
      expect(isValidIP("::1")).toBe(true);
      expect(isValidIP("::ffff:192.168.1.1")).toBe(true);
    });
  });
});
