/**
 * Nylas Webhook Verification & Parsing
 */

import crypto from "crypto";
import { logError } from "@/lib/logging";

export type NylasWebhookEvent =
  | "grant.created"
  | "grant.expired"
  | "grant.deleted"
  | "event.created"
  | "event.updated"
  | "event.deleted"
  | "booking.created"
  | "booking.cancelled"
  | "booking.rescheduled";

export interface NylasWebhookPayload {
  specversion: string;
  type: NylasWebhookEvent;
  source: string;
  id: string;
  time: number;
  data: {
    application_id?: string;
    object: Record<string, unknown>;
    grant_id?: string;
  };
}

/**
 * Verify Nylas webhook signature
 */
export function verifyNylasWebhook(
  rawBody: string,
  signature: string
): boolean {
  const secret = process.env.NYLAS_WEBHOOK_SECRET;
  if (!secret) {
    logError("Nylas Webhook", "NYLAS_WEBHOOK_SECRET not configured");
    return false;
  }

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const expectedSignature = hmac.digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Parse a Nylas webhook payload
 */
export function parseNylasWebhook(body: unknown): NylasWebhookPayload | null {
  try {
    const payload = body as NylasWebhookPayload;
    if (!payload.type || !payload.data) return null;
    return payload;
  } catch {
    return null;
  }
}
