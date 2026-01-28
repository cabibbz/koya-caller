/**
 * Stripe Connect OAuth Initiation Route
 *
 * POST /api/integrations/stripe_connect/auth
 * Initiates the Stripe Connect OAuth flow
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

const STRIPE_CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID;

/**
 * Generate a secure state token for OAuth
 */
function generateOAuthState(businessId: string, returnUrl: string): string {
  const nonce = crypto.randomUUID();
  const state = {
    businessId,
    returnUrl,
    nonce,
    timestamp: Date.now(),
  };
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

async function handlePOST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get business
    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Check if Stripe Connect is configured
    if (!STRIPE_CLIENT_ID) {
      return NextResponse.json(
        { error: "Stripe Connect is not configured. Please contact support." },
        { status: 503 }
      );
    }

    // Get return URL from request body
    const body = await request.json().catch(() => ({}));
    const returnUrl = body.returnUrl || "/integrations";

    // Generate state token
    const state = generateOAuthState(business.id, returnUrl);

    // Build authorization URL
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/stripe_connect/callback`;
    const authUrl = `https://connect.stripe.com/oauth/authorize?` +
      new URLSearchParams({
        response_type: "code",
        client_id: STRIPE_CLIENT_ID,
        scope: "read_write",
        redirect_uri: redirectUri,
        state,
        // Pre-fill business info if available
        "stripe_user[business_name]": business.name || "",
        "stripe_user[email]": user.email || "",
      }).toString();

    // Set state in a secure cookie for validation on callback
    const response = NextResponse.json({
      success: true,
      authUrl,
    });

    response.cookies.set("stripe_connect_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    logError("Stripe Connect Auth", error);
    return NextResponse.json(
      { error: "Failed to initiate Stripe connection" },
      { status: 500 }
    );
  }
}

export const POST = withDashboardRateLimit(handlePOST);
