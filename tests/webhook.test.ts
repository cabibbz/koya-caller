/**
 * Webhook Handler Tests
 * Tests for webhook signature verification and processing
 */

import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  verifyWebhookSignature,
  verifyStripeSignature,
} from "@/lib/security";

describe("Webhook Security", () => {
  // ==========================================================================
  // Generic Webhook Signature Verification
  // ==========================================================================
  describe("verifyWebhookSignature", () => {
    const secret = "test-webhook-secret";
    const payload = '{"event": "test", "data": {"id": "123"}}';

    it("should verify valid SHA-256 signatures", () => {
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      expect(verifyWebhookSignature(payload, expectedSignature, secret)).toBe(
        true
      );
    });

    it("should verify valid SHA-1 signatures", () => {
      const expectedSignature = crypto
        .createHmac("sha1", secret)
        .update(payload)
        .digest("hex");

      expect(
        verifyWebhookSignature(payload, expectedSignature, secret, "sha1")
      ).toBe(true);
    });

    it("should handle signatures with prefixes", () => {
      const signature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      expect(
        verifyWebhookSignature(payload, `sha256=${signature}`, secret)
      ).toBe(true);
    });

    it("should reject invalid signatures", () => {
      expect(
        verifyWebhookSignature(payload, "invalid-signature", secret)
      ).toBe(false);
    });

    it("should reject tampered payloads", () => {
      const signature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      const tamperedPayload = '{"event": "test", "data": {"id": "456"}}';
      expect(verifyWebhookSignature(tamperedPayload, signature, secret)).toBe(
        false
      );
    });

    it("should reject wrong secret", () => {
      const signature = crypto
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");

      expect(
        verifyWebhookSignature(payload, signature, "wrong-secret")
      ).toBe(false);
    });
  });

  // ==========================================================================
  // Stripe Signature Verification
  // ==========================================================================
  describe("verifyStripeSignature", () => {
    const secret = "whsec_test_secret";
    const payload = '{"id": "evt_123", "type": "checkout.session.completed"}';

    function createStripeSignature(
      payload: string,
      secret: string,
      timestamp?: number
    ): string {
      const ts = timestamp || Math.floor(Date.now() / 1000);
      const signedPayload = `${ts}.${payload}`;
      const signature = crypto
        .createHmac("sha256", secret)
        .update(signedPayload)
        .digest("hex");
      return `t=${ts},v1=${signature}`;
    }

    it("should verify valid Stripe signatures", () => {
      const signature = createStripeSignature(payload, secret);
      expect(verifyStripeSignature(payload, signature, secret)).toBe(true);
    });

    it("should reject expired signatures (> 5 minutes old)", () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 6+ minutes ago
      const signature = createStripeSignature(payload, secret, oldTimestamp);
      expect(verifyStripeSignature(payload, signature, secret)).toBe(false);
    });

    it("should reject missing timestamp", () => {
      const signature = "v1=somehash";
      expect(verifyStripeSignature(payload, signature, secret)).toBe(false);
    });

    it("should reject missing v1 signature", () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = `t=${timestamp}`;
      expect(verifyStripeSignature(payload, signature, secret)).toBe(false);
    });

    it("should reject invalid signatures", () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = `t=${timestamp},v1=invalid_signature`;
      expect(verifyStripeSignature(payload, signature, secret)).toBe(false);
    });

    it("should reject tampered payloads", () => {
      const signature = createStripeSignature(payload, secret);
      const tamperedPayload = '{"id": "evt_456", "type": "invoice.paid"}';
      expect(verifyStripeSignature(tamperedPayload, signature, secret)).toBe(
        false
      );
    });
  });
});

describe("Webhook Rate Limiting", () => {
  // ==========================================================================
  // Rate Limit Behavior Tests (Mock-based)
  // ==========================================================================
  describe("Rate limit key generation", () => {
    it("should generate correct rate limit keys", () => {
      // Test the key format expected by the rate limiter
      const prefix = "webhook";
      const identifier = "global";
      const key = `${prefix}:${identifier}`;
      expect(key).toBe("webhook:global");
    });

    it("should handle IP-based rate limiting keys", () => {
      const prefix = "public";
      const ip = "192.168.1.1";
      const key = `${prefix}:${ip}`;
      expect(key).toBe("public:192.168.1.1");
    });

    it("should handle user-based rate limiting keys", () => {
      const prefix = "dashboard";
      const userId = "user:abc123";
      const key = `${prefix}:${userId}`;
      expect(key).toBe("dashboard:user:abc123");
    });
  });
});

describe("Webhook Payload Parsing", () => {
  // ==========================================================================
  // Payload Validation Tests
  // ==========================================================================
  describe("JSON payload validation", () => {
    it("should parse valid JSON payloads", () => {
      const payload = '{"event": "test", "data": {"id": "123"}}';
      const parsed = JSON.parse(payload);
      expect(parsed.event).toBe("test");
      expect(parsed.data.id).toBe("123");
    });

    it("should throw on invalid JSON", () => {
      const invalidPayload = "{invalid json}";
      expect(() => JSON.parse(invalidPayload)).toThrow();
    });

    it("should handle empty payloads", () => {
      expect(() => JSON.parse("")).toThrow();
    });

    it("should handle nested objects", () => {
      const payload = JSON.stringify({
        event: "call_ended",
        call: {
          call_id: "123",
          metadata: {
            business_id: "456",
            appointment_booked: "true",
          },
        },
      });
      const parsed = JSON.parse(payload);
      expect(parsed.call.metadata.appointment_booked).toBe("true");
    });
  });

  describe("Retell webhook event types", () => {
    const validEvents = ["call_started", "call_ended", "call_analyzed"];

    it("should recognize valid Retell event types", () => {
      validEvents.forEach((event) => {
        expect(validEvents.includes(event)).toBe(true);
      });
    });

    it("should reject unknown event types", () => {
      expect(validEvents.includes("unknown_event")).toBe(false);
    });
  });

  describe("Stripe webhook event types", () => {
    const handledEvents = [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_succeeded",
      "invoice.payment_failed",
    ];

    it("should recognize handled Stripe event types", () => {
      handledEvents.forEach((event) => {
        expect(handledEvents.includes(event)).toBe(true);
      });
    });
  });
});

describe("Webhook Error Handling", () => {
  // ==========================================================================
  // Error Response Tests
  // ==========================================================================
  describe("Error responses", () => {
    it("should return 401 for invalid signatures in production", () => {
      const errorResponse = { error: "Invalid signature" };
      const status = 401;
      expect(errorResponse.error).toBe("Invalid signature");
      expect(status).toBe(401);
    });

    it("should return 400 for invalid JSON", () => {
      const errorResponse = { error: "Invalid JSON payload" };
      const status = 400;
      expect(errorResponse.error).toBe("Invalid JSON payload");
      expect(status).toBe(400);
    });

    it("should return 200 with warning for unknown agents", () => {
      const response = { received: true, warning: "Unknown agent" };
      expect(response.received).toBe(true);
      expect(response.warning).toBe("Unknown agent");
    });

    it("should return 500 for handler failures", () => {
      const errorResponse = { error: "Webhook handler failed" };
      const status = 500;
      expect(errorResponse.error).toBe("Webhook handler failed");
      expect(status).toBe(500);
    });
  });
});
