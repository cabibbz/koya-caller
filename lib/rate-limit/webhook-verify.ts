/**
 * Webhook Signature Verification
 * 
 * Spec Reference: Part 20, Lines 2188-2216
 * 
 * Provides signature verification for webhooks from:
 * - Retell.ai
 * - Twilio
 * - Stripe
 */

import crypto from "crypto";

// =============================================================================
// Retell Webhook Verification (Spec Lines 2194-2204)
// =============================================================================

/**
 * Verify Retell webhook signature
 * 
 * @param payload - The raw request body as a string
 * @param signature - The x-retell-signature header value
 * @param secret - The RETELL_WEBHOOK_SECRET
 * @returns true if signature is valid
 */
export function verifyRetellSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// =============================================================================
// Twilio Webhook Verification
// =============================================================================

/**
 * Verify Twilio webhook signature
 * 
 * Twilio uses a different signature format - the URL and POST params are
 * sorted and concatenated, then HMAC-SHA1 signed.
 * 
 * For simplicity, we recommend using Twilio's official SDK validation:
 * import twilio from 'twilio';
 * twilio.validateRequest(authToken, signature, url, params)
 * 
 * This function provides a basic implementation for reference.
 */
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
  authToken: string
): boolean {
  if (!signature) {
    return false;
  }

  try {
    // Sort params alphabetically and concatenate
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

// =============================================================================
// Stripe Webhook Verification
// =============================================================================

/**
 * Verify Stripe webhook signature
 * 
 * Stripe uses a timestamp + payload signature format.
 * For production, use the official Stripe SDK:
 * stripe.webhooks.constructEvent(payload, signature, endpointSecret)
 * 
 * This function provides basic verification for reference.
 */
export function verifyStripeSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
  tolerance: number = 300 // 5 minutes
): boolean {
  if (!signatureHeader) {
    return false;
  }

  try {
    // Parse the signature header
    // Format: t=timestamp,v1=signature,v0=signature(deprecated)
    const elements = signatureHeader.split(",");
    const signatures: { t?: string; v1?: string } = {};

    for (const element of elements) {
      const [key, value] = element.split("=");
      if (key === "t") signatures.t = value;
      if (key === "v1") signatures.v1 = value;
    }

    if (!signatures.t || !signatures.v1) {
      return false;
    }

    const timestamp = parseInt(signatures.t, 10);
    const now = Math.floor(Date.now() / 1000);

    // Check timestamp tolerance
    if (Math.abs(now - timestamp) > tolerance) {
      return false;
    }

    // Compute expected signature
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

// =============================================================================
// Generic HMAC Verification
// =============================================================================

/**
 * Generic HMAC signature verification
 * 
 * @param payload - The payload to verify
 * @param signature - The signature to check
 * @param secret - The secret key
 * @param algorithm - The hash algorithm (default: sha256)
 * @param encoding - The signature encoding (default: hex)
 */
export function verifyHmacSignature(
  payload: string,
  signature: string | null,
  secret: string,
  algorithm: "sha256" | "sha1" = "sha256",
  encoding: "hex" | "base64" = "hex"
): boolean {
  if (!signature) {
    return false;
  }

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

// =============================================================================
// Helper to extract headers from request
// =============================================================================

export interface WebhookHeaders {
  retellSignature: string | null;
  twilioSignature: string | null;
  stripeSignature: string | null;
}

export function extractWebhookHeaders(request: Request): WebhookHeaders {
  return {
    retellSignature: request.headers.get("x-retell-signature"),
    twilioSignature: request.headers.get("x-twilio-signature"),
    stripeSignature: request.headers.get("stripe-signature"),
  };
}
