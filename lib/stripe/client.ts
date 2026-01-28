/**
 * Stripe Client Configuration
 * Session 19: Dashboard - Billing & Admin
 * 
 * Initializes and exports the Stripe SDK client for server-side operations.
 * Used for:
 * - Creating checkout sessions
 * - Managing customer portal sessions
 * - Processing webhook events
 */

import Stripe from "stripe";

/**
 * Lazy-initialized Stripe client to avoid build-time errors
 * when environment variables are not set.
 */
let _stripe: Stripe | null = null;

/**
 * Get the Stripe client instance.
 * Throws an error if STRIPE_SECRET_KEY is not configured.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("Missing STRIPE_SECRET_KEY environment variable");
    }
    _stripe = new Stripe(secretKey, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    });
  }
  return _stripe;
}

/**
 * Stripe client instance - exported for backwards compatibility.
 * Note: This will throw at runtime if STRIPE_SECRET_KEY is not set.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  },
});

/**
 * Plan slug to Stripe Price ID mapping.
 * 
 * These IDs should be configured in Stripe Dashboard and stored in
 * environment variables for production use.
 */
export const PLAN_PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || "",
  professional: process.env.STRIPE_PRICE_PROFESSIONAL || "",
  business: process.env.STRIPE_PRICE_BUSINESS || "",
};

/**
 * Get the Stripe Price ID for a given plan slug.
 */
export function getPriceIdForPlan(planSlug: string): string | null {
  return PLAN_PRICE_IDS[planSlug] || null;
}

/**
 * Stripe webhook secret for verifying webhook signatures.
 */
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
