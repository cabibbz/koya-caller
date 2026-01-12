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
import type Stripe from "stripe";

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
 */
async function getPlanFromPriceId(supabase: ReturnType<typeof createAdminClient>, priceId: string): Promise<PlanRecord | null> {
  const { data: plan } = await (supabase as any)
    .from("plans")
    .select("*")
    .eq("stripe_price_id", priceId)
    .single();
  
  return plan as PlanRecord | null;
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
    return;
  }
  
  // Get subscription details to find the plan
  let plan = null;
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price?.id;
    if (priceId) {
      plan = await getPlanFromPriceId(supabase, priceId);
    }
  }
  
  // Update business with Stripe IDs and subscription status
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
    const { data: business } = await (supabase as any)
      .from("businesses")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .single();
    
    targetBusinessId = (business as { id: string } | null)?.id || null;
  }
  
  if (!targetBusinessId) {
    return;
  }
  
  // Get plan from price ID
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = priceId ? await getPlanFromPriceId(supabase, priceId) : null;
  
  // Calculate cycle dates from subscription
  const cycleStart = new Date(subscription.current_period_start * 1000)
    .toISOString()
    .split("T")[0];
  const cycleEnd = new Date(subscription.current_period_end * 1000)
    .toISOString()
    .split("T")[0];
  
  // Update business
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
  const { data: business } = await (supabase as any)
    .from("businesses")
    .select("id")
    .or(`stripe_subscription_id.eq.${subscription.id},stripe_customer_id.eq.${customerId}`)
    .single();
  
  const biz = business as { id: string } | null;
  
  if (!biz) {
    return;
  }

  // Get plan from current price
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = priceId ? await getPlanFromPriceId(supabase, priceId) : null;
  
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
    console.error("[Stripe Webhook] Signature verification failed:", err);
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
    console.error("[Stripe Webhook] Handler error:", error);
    // Return 500 so Stripe retries
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
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
