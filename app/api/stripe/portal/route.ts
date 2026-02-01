/**
 * Stripe Billing Portal Route
 * Session 19: Dashboard - Billing & Admin
 * 
 * Creates a Stripe Customer Portal session and redirects the user.
 * 
 * Spec Reference: Part 7, Lines 800-810 (Phone & Billing settings)
 * 
 * The portal allows customers to:
 * - View and download invoices
 * - Update payment methods
 * - Cancel or pause subscriptions
 * - View billing history
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { withRateLimit } from "@/lib/rate-limit/middleware";

/**
 * GET /api/stripe/portal
 * 
 * Creates a Stripe Customer Portal session and redirects the user.
 * 
 * Requirements:
 * - User must be authenticated
 * - Business must have a stripe_customer_id
 * 
 * Returns: Redirect to Stripe Customer Portal
 */
export const GET = withRateLimit(
  async (request: NextRequest) => {
    try {
      // Get authenticated user
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.redirect(new URL("/login", request.url));
      }

      // Get business with Stripe customer ID
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
      const { data: business, error: businessError } = await (supabase as any)
        .from("businesses")
        .select("id, stripe_customer_id")
        .eq("user_id", user.id)
        .single();

      if (businessError || !business) {
        return NextResponse.redirect(new URL("/settings?error=no_business", request.url));
      }

      // Cast business to expected type
      const biz = business as {
        id: string;
        stripe_customer_id: string | null;
      };

      if (!biz.stripe_customer_id) {
        return NextResponse.redirect(new URL("/settings?error=no_stripe_customer", request.url));
      }

      // Create portal session
      const returnUrl = new URL("/settings", request.url).toString();
      
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: biz.stripe_customer_id,
        return_url: returnUrl,
      });

      // Redirect to portal
      return NextResponse.redirect(portalSession.url);
    } catch (error) {
      // Handle Stripe-specific errors
      if (error instanceof Error && error.message.includes("No such customer")) {
        return NextResponse.redirect(new URL("/settings?error=invalid_customer", request.url));
      }
      
      return NextResponse.redirect(new URL("/settings?error=portal_error", request.url));
    }
  },
  { 
    type: "dashboard",
  }
);
