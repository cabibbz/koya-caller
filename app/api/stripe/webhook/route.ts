/**
 * Stripe Webhook Handler
 * Session 19: Dashboard - Billing & Admin
 * 
 * Spec Reference: Part 20 (Rate limiting), Part 7 (Billing)
 * 
 * Handles incoming webhooks from Stripe for:
 * - Checkout session completed (new subscription)
 * - Subscription created/updated/deleted
 * - Invoice payment succeeded/failed
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/client";
import { logError, logErrorWithMeta } from "@/lib/logging";
import { storeFailedWebhook } from "@/lib/webhooks/retry";
import { sendAdminAlertEmail } from "@/lib/email";
import type Stripe from "stripe";

// Admin email for critical alerts (should be configured in env)
const ADMIN_EMAIL = process.env.ADMIN_ALERT_EMAIL || process.env.SUPPORT_EMAIL;

/**
 * Custom error for plan lookup failures - allows proceeding with defaults
 * while still alerting admins
 */
class PlanLookupError extends Error {
  constructor(
    message: string,
    public readonly priceId: string,
    public readonly businessId?: string,
    public readonly isDbError: boolean = false
  ) {
    super(message);
    this.name = "PlanLookupError";
  }
}

/**
 * Extract business ID from subscription or checkout metadata
 */
function getBusinessIdFromObject(obj: Stripe.Subscription | Stripe.Checkout.Session): string | null {
  if ('metadata' in obj && obj.metadata?.business_id) {
    return obj.metadata.business_id;
  }
  return null;
}

/**
 * Plan type for type-safe access
 */
interface PlanRecord {
  id: string;
  slug: string;
  name: string;
  price_cents: number;
  included_minutes: number;
  features: object | null;
  stripe_price_id: string | null;
  sort_order: number;
  is_active: boolean;
}

/**
 * Get plan details from Stripe Price ID
 * Throws PlanLookupError on failure to ensure proper error handling
 */
async function getPlanFromPriceId(
  supabase: ReturnType<typeof createAdminClient>,
  priceId: string,
  businessId?: string
): Promise<PlanRecord> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan, error } = await (supabase as any)
    .from("plans")
    .select("*")
    .eq("stripe_price_id", priceId)
    .single();

  if (error) {
    throw new PlanLookupError(
      `Database error looking up plan for price ID ${priceId}: ${error.message}`,
      priceId,
      businessId,
      true
    );
  }

  if (!plan) {
    throw new PlanLookupError(
      `No plan found for Stripe price ID: ${priceId}`,
      priceId,
      businessId,
      false
    );
  }

  return plan as PlanRecord;
}

/**
 * Send admin alert for plan lookup failures
 */
async function alertPlanLookupFailure(
  error: PlanLookupError,
  eventType: string,
  subscriptionId?: string
): Promise<void> {
  logErrorWithMeta("Stripe Webhook - Plan Lookup Failed", error, {
    priceId: error.priceId,
    businessId: error.businessId,
    isDbError: error.isDbError,
    eventType,
  });

  // Send admin alert if configured
  if (ADMIN_EMAIL) {
    await sendAdminAlertEmail({
      to: ADMIN_EMAIL,
      alertType: "plan_mismatch",
      title: "Stripe Plan Lookup Failed",
      description: `A Stripe webhook could not find the matching plan. The business has been assigned default minutes (200) which may be incorrect.`,
      severity: "high",
      details: {
        "Event Type": eventType,
        "Price ID": error.priceId,
        "Business ID": error.businessId || "Unknown",
        "Subscription ID": subscriptionId || "N/A",
        "Error Type": error.isDbError ? "Database Error" : "Plan Not Found",
        "Error Message": error.message,
        "Action Required": "Verify the Stripe Price ID is correctly mapped to a plan in the database",
      },
    });
  }
}

/**
 * Handle checkout.session.completed
 * Triggered when a customer completes checkout for a new subscription.
 */
async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createAdminClient>,
  session: Stripe.Checkout.Session
) {
  const businessId = session.metadata?.business_id;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!businessId) {
    logError("Stripe Webhook - Checkout", `Checkout session ${session.id} has no business_id in metadata. Cannot update business.`);
    return;
  }

  // Get subscription details to find the plan
  let plan: PlanRecord | null = null;
  let planLookupFailed = false;

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price?.id;
    if (priceId) {
      try {
        plan = await getPlanFromPriceId(supabase, priceId, businessId);
      } catch (err) {
        if (err instanceof PlanLookupError) {
          planLookupFailed = true;
          // Alert admins about the failure - critical because customer just paid
          await alertPlanLookupFailure(err, "checkout.session.completed", subscriptionId);
        } else {
          throw err; // Re-throw unexpected errors
        }
      }
    }
  }

  // Update business with Stripe IDs and subscription status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("businesses")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: "active",
      plan_id: plan?.id || null,
      minutes_included: plan?.included_minutes || 200,
      current_cycle_start: new Date().toISOString().split("T")[0],
      current_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      minutes_used_this_cycle: 0,
      updated_at: new Date().toISOString(),
      // Track if plan lookup failed for future reconciliation
      ...(planLookupFailed ? { plan_lookup_failed: true } : {}),
    })
    .eq("id", businessId);

  if (error) {
    throw error;
  }
}

/**
 * Handle customer.subscription.created
 * Triggered when a new subscription is created.
 */
async function handleSubscriptionCreated(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription
) {
  const businessId = getBusinessIdFromObject(subscription);
  const customerId = subscription.customer as string;

  // Try to find business by customer ID if not in metadata
  let targetBusinessId: string | null | undefined = businessId;
  if (!targetBusinessId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: business } = await (supabase as any)
      .from("businesses")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .single();

    targetBusinessId = (business as { id: string } | null)?.id || null;
  }

  if (!targetBusinessId) {
    logError("Stripe Webhook - Subscription Created", `Cannot find business for subscription ${subscription.id} (customer: ${customerId}). Subscription not linked.`);
    return;
  }

  // Get plan from price ID
  const priceId = subscription.items.data[0]?.price?.id;
  let plan: PlanRecord | null = null;
  let planLookupFailed = false;

  if (priceId) {
    try {
      plan = await getPlanFromPriceId(supabase, priceId, targetBusinessId);
    } catch (err) {
      if (err instanceof PlanLookupError) {
        planLookupFailed = true;
        await alertPlanLookupFailure(err, "customer.subscription.created", subscription.id);
      } else {
        throw err;
      }
    }
  }

  // Calculate cycle dates from subscription
  const cycleStart = new Date(subscription.current_period_start * 1000)
    .toISOString()
    .split("T")[0];
  const cycleEnd = new Date(subscription.current_period_end * 1000)
    .toISOString()
    .split("T")[0];

  // Update business
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("businesses")
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status === "active" ? "active" : subscription.status,
      plan_id: plan?.id || null,
      minutes_included: plan?.included_minutes || 200,
      current_cycle_start: cycleStart,
      current_cycle_end: cycleEnd,
      updated_at: new Date().toISOString(),
      ...(planLookupFailed ? { plan_lookup_failed: true } : {}),
    })
    .eq("id", targetBusinessId);

  if (error) {
    throw error;
  }
}

/**
 * Handle customer.subscription.updated
 * Triggered when subscription is modified (plan change, status change, etc.)
 */
async function handleSubscriptionUpdated(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;

  // Find business by subscription ID or customer ID
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: business } = await (supabase as any)
    .from("businesses")
    .select("id")
    .or(`stripe_subscription_id.eq.${subscription.id},stripe_customer_id.eq.${customerId}`)
    .single();

  const biz = business as { id: string } | null;

  if (!biz) {
    logError("Stripe Webhook - Subscription Updated", `Cannot find business for subscription ${subscription.id} (customer: ${customerId}). Update skipped.`);
    return;
  }

  // Get plan from current price
  const priceId = subscription.items.data[0]?.price?.id;
  let plan: PlanRecord | null = null;
  let planLookupFailed = false;

  if (priceId) {
    try {
      plan = await getPlanFromPriceId(supabase, priceId, biz.id);
    } catch (err) {
      if (err instanceof PlanLookupError) {
        planLookupFailed = true;
        await alertPlanLookupFailure(err, "customer.subscription.updated", subscription.id);
      } else {
        throw err;
      }
    }
  }

  // Map Stripe status to our status
  let status: string;
  switch (subscription.status) {
    case "active":
      status = "active";
      break;
    case "past_due":
    case "unpaid":
      status = "paused";
      break;
    case "canceled":
      status = "cancelled";
      break;
    default:
      status = subscription.status;
  }

  // Update business
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("businesses")
    .update({
      subscription_status: status,
      plan_id: plan?.id || null,
      minutes_included: plan?.included_minutes || undefined,
      current_cycle_start: new Date(subscription.current_period_start * 1000)
        .toISOString()
        .split("T")[0],
      current_cycle_end: new Date(subscription.current_period_end * 1000)
        .toISOString()
        .split("T")[0],
      updated_at: new Date().toISOString(),
      ...(planLookupFailed ? { plan_lookup_failed: true } : {}),
    })
    .eq("id", biz.id);

  if (error) {
    throw error;
  }
}

/**
 * Handle customer.subscription.deleted
 * Triggered when subscription is cancelled.
 */
async function handleSubscriptionDeleted(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription
) {
  
  // Find business by subscription ID
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: business } = await (supabase as any)
    .from("businesses")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  const biz = business as { id: string } | null;

  if (!biz) {
    return;
  }

  // Update business status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("businesses")
    .update({
      subscription_status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", biz.id);
  
  if (error) {
    throw error;
  }
}

/**
 * Handle invoice.payment_succeeded
 * Triggered when an invoice is paid (including renewals).
 */
async function handleInvoicePaymentSucceeded(
  supabase: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice
) {
  
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) {
    return; // One-time payment, not subscription
  }
  
  // Find business
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: business } = await (supabase as any)
    .from("businesses")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  const biz = business as { id: string } | null;

  if (!biz) {
    return;
  }

  // Get subscription for new billing cycle dates
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Reset minutes for new billing cycle
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("businesses")
    .update({
      subscription_status: "active",
      minutes_used_this_cycle: 0,
      last_usage_alert_percent: 0,
      current_cycle_start: new Date(subscription.current_period_start * 1000)
        .toISOString()
        .split("T")[0],
      current_cycle_end: new Date(subscription.current_period_end * 1000)
        .toISOString()
        .split("T")[0],
      updated_at: new Date().toISOString(),
    })
    .eq("id", biz.id);
  
  if (error) {
    throw error;
  }
}

/**
 * Handle invoice.payment_failed
 * Triggered when a payment fails.
 */
async function handleInvoicePaymentFailed(
  supabase: ReturnType<typeof createAdminClient>,
  invoice: Stripe.Invoice
) {
  
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;
  
  // Find business
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: business } = await (supabase as any)
    .from("businesses")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  const biz = business as { id: string } | null;

  if (!biz) {
    return;
  }

  // Update status to paused
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("businesses")
    .update({
      subscription_status: "paused",
      updated_at: new Date().toISOString(),
    })
    .eq("id", biz.id);
  
  if (error) {
    throw error;
  }
}

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events with:
 * - Official Stripe SDK signature verification
 * - Proper error handling for retries
 */
export async function POST(request: NextRequest) {
  // Get raw payload for signature verification
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 401 }
    );
  }

  // Verify signature using official Stripe SDK
  // This handles timestamp validation, replay protection, and proper HMAC verification
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    logError("Stripe Webhook - signature verification", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 401 }
    );
  }

  // Create admin client for database operations
  const supabase = createAdminClient();

  try {
    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          supabase,
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case "customer.subscription.created":
        await handleSubscriptionCreated(
          supabase,
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          supabase,
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          supabase,
          event.data.object as Stripe.Subscription
        );
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(
          supabase,
          event.data.object as Stripe.Invoice
        );
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(
          supabase,
          event.data.object as Stripe.Invoice
        );
        break;

      default:
        // Unhandled event type - ignored
    }
  } catch (error) {
    logError("Stripe Webhook - handler", error);

    // Store the failed webhook for retry
    await storeFailedWebhook({
      source: "stripe",
      eventType: event.type,
      payload: event as unknown as Record<string, unknown>,
      error: error instanceof Error ? error : new Error(String(error)),
    });

    // Return 200 to acknowledge receipt (we'll handle retry internally)
    // This prevents Stripe from retrying and creating duplicate events
    return NextResponse.json({ received: true, queued_for_retry: true });
  }

  // Return success (Stripe expects 200 OK)
  return NextResponse.json({ received: true });
}

// Prevent other HTTP methods
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
