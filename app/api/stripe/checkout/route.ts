/**
 * Stripe Checkout Route
 * Session 19: Dashboard - Billing & Admin
 * 
 * Creates Stripe Checkout sessions for:
 * - New subscriptions
 * - Plan upgrades/downgrades
 * 
 * Spec Reference: Part 7, Lines 800-810 (Billing settings)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, getPriceIdForPlan } from "@/lib/stripe/client";
import { withRateLimit } from "@/lib/rate-limit/middleware";

interface CheckoutRequest {
  planSlug: string;
  mode?: "subscription" | "upgrade";
}

/**
 * POST /api/stripe/checkout
 * 
 * Creates a Stripe Checkout session for subscription management.
 * 
 * Body:
 * - planSlug: 'starter' | 'professional' | 'business'
 * - mode: 'subscription' (new) | 'upgrade' (change plan)
 * 
 * Returns: { url: string } - Stripe Checkout URL
 */
export const POST = withRateLimit(
  async (request: NextRequest) => {
    try {
      // Get authenticated user
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }

      // Parse request body
      const body: CheckoutRequest = await request.json();
      const { planSlug, mode = "subscription" } = body;

      // Validate plan slug
      const validPlans = ["starter", "professional", "business"];
      if (!planSlug || !validPlans.includes(planSlug)) {
        return NextResponse.json(
          { error: "Invalid plan selected" },
          { status: 400 }
        );
      }

      // Get price ID for plan
      const priceId = getPriceIdForPlan(planSlug);
      if (!priceId) {
        return NextResponse.json(
          { error: "Plan price not configured. Please contact support." },
          { status: 500 }
        );
      }

      // Get business
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      const { data: business, error: businessError } = await (supabase as any)
        .from("businesses")
        .select("id, name, stripe_customer_id, stripe_subscription_id")
        .eq("user_id", user.id)
        .single();

      if (businessError || !business) {
        return NextResponse.json(
          { error: "Business not found" },
          { status: 404 }
        );
      }

      // Cast business to expected type
      const biz = business as {
        id: string;
        name: string;
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
      };

      // Determine checkout mode
      if (mode === "upgrade" && biz.stripe_subscription_id) {
        // For upgrades, use the billing portal instead of a new checkout
        // This allows proration and immediate plan changes
        if (!biz.stripe_customer_id) {
          return NextResponse.json(
            { error: "No Stripe customer found for upgrade" },
            { status: 400 }
          );
        }

        // Update subscription directly via API
        try {
          const subscription = await stripe.subscriptions.retrieve(
            biz.stripe_subscription_id
          );

          // Update to new price
          await stripe.subscriptions.update(biz.stripe_subscription_id, {
            cancel_at_period_end: false,
            proration_behavior: "create_prorations",
            items: [
              {
                id: subscription.items.data[0].id,
                price: priceId,
              },
            ],
          });

          return NextResponse.json({
            success: true,
            message: "Plan updated successfully",
          });
        } catch (_upgradeError) {
          // Fall back to portal for complex cases
          const portalSession = await stripe.billingPortal.sessions.create({
            customer: biz.stripe_customer_id,
            return_url: new URL("/settings?upgraded=true", request.url).toString(),
          });

          return NextResponse.json({
            url: portalSession.url,
            redirect: true,
          });
        }
      }

      // Create new checkout session for new subscriptions
      const successUrl = new URL("/settings?checkout=success", request.url);
      const cancelUrl = new URL("/settings?checkout=cancelled", request.url);

      // Build checkout params - using object literal with conditional customer
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: successUrl.toString(),
        cancel_url: cancelUrl.toString(),
        ...(biz.stripe_customer_id 
          ? { customer: biz.stripe_customer_id }
          : { customer_email: user.email || undefined }
        ),
        metadata: {
          business_id: biz.id,
          user_id: user.id,
          plan_slug: planSlug,
        },
        subscription_data: {
          metadata: {
            business_id: biz.id,
          },
        },
        allow_promotion_codes: true,
      });

      return NextResponse.json({
        url: checkoutSession.url,
      });
    } catch (_error) {
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }
  },
  {
    type: "dashboard",
  }
);
