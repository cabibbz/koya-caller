/**
 * Shopify OAuth Initiation Route
 *
 * POST /api/integrations/shopify/auth
 * Initiates the Shopify OAuth flow
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

// Shopify OAuth configuration
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_SCOPES = [
  "read_products",
  "read_inventory",
  "read_orders",
  "read_customers",
].join(",");

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

    // Check if Shopify is configured
    if (!SHOPIFY_CLIENT_ID) {
      return NextResponse.json(
        { error: "Shopify integration is not configured. Please contact support." },
        { status: 503 }
      );
    }

    // Get shop domain and return URL from request body
    const body = await request.json().catch(() => ({}));
    const shopDomain = body.shopDomain;
    const returnUrl = body.returnUrl || "/integrations";

    if (!shopDomain) {
      return NextResponse.json(
        { error: "Please provide your Shopify store domain (e.g., your-store.myshopify.com)" },
        { status: 400 }
      );
    }

    // Normalize shop domain
    const normalizedShop = shopDomain
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .toLowerCase();

    // Validate shop domain format
    if (!normalizedShop.endsWith(".myshopify.com")) {
      return NextResponse.json(
        { error: "Please enter a valid Shopify store domain (ending in .myshopify.com)" },
        { status: 400 }
      );
    }

    // Generate state token
    const state = generateOAuthState(business.id, returnUrl);

    // Build authorization URL
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/shopify/callback`;
    const authUrl = `https://${normalizedShop}/admin/oauth/authorize?` +
      new URLSearchParams({
        client_id: SHOPIFY_CLIENT_ID,
        scope: SHOPIFY_SCOPES,
        redirect_uri: redirectUri,
        state,
      }).toString();

    // Set state in a secure cookie for validation on callback
    const response = NextResponse.json({
      success: true,
      authUrl,
    });

    // Store state and shop in cookies
    response.cookies.set("shopify_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    });

    response.cookies.set("shopify_shop", normalizedShop, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    logError("Shopify Auth", error);
    return NextResponse.json(
      { error: "Failed to initiate Shopify connection" },
      { status: 500 }
    );
  }
}

export const POST = withDashboardRateLimit(handlePOST);
