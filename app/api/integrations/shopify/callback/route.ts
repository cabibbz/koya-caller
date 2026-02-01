/**
 * Shopify OAuth Callback Route
 *
 * GET /api/integrations/shopify/callback
 * Handles the OAuth callback from Shopify
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;

/**
 * Parse OAuth state token
 */
function parseOAuthState(state: string): {
  businessId: string;
  returnUrl: string;
  nonce: string;
  timestamp: number;
} | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded);

    if (!parsed.businessId || !parsed.returnUrl || !parsed.nonce) {
      return null;
    }

    // Check if state is not too old (15 minutes max)
    const maxAge = 15 * 60 * 1000;
    if (Date.now() - parsed.timestamp > maxAge) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const shop = searchParams.get("shop");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Base URL for redirects
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Handle error from Shopify
  if (error) {
    const message = errorDescription || "Authorization was denied";
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=${encodeURIComponent(message)}`
    );
  }

  // Validate required parameters
  if (!code || !state || !shop) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=${encodeURIComponent("Missing required parameters")}`
    );
  }

  // Validate state matches cookie
  const storedState = request.cookies.get("shopify_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=${encodeURIComponent("Invalid request state")}`
    );
  }

  // Validate shop matches cookie
  const storedShop = request.cookies.get("shopify_shop")?.value;
  if (!storedShop || storedShop !== shop) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=${encodeURIComponent("Shop mismatch")}`
    );
  }

  // Parse state to get business ID and return URL
  const stateData = parseOAuthState(state);
  if (!stateData) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=${encodeURIComponent("Invalid or expired request")}`
    );
  }

  const { businessId, returnUrl } = stateData;

  // Validate returnUrl is a safe relative path (prevent open redirect)
  const allowedReturnPaths = ["/integrations", "/settings", "/dashboard/integrations", "/dashboard/settings", "/dashboard"];
  const safeReturnUrl = returnUrl && allowedReturnPaths.some(path =>
    returnUrl === path || returnUrl.startsWith(path + "?") || returnUrl.startsWith(path + "/")
  ) ? returnUrl : "/integrations";

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange authorization code");
    }

    const tokens = await tokenResponse.json();

    // Store tokens in database
    const supabase = createAdminClient();
    // Type assertion needed since business_integrations is a new table
    const { error: dbError } = await (supabase as any)
      .from("business_integrations")
      .upsert(
        {
          business_id: businessId,
          provider: "shopify",
          access_token: tokens.access_token,
          shop_domain: shop,
          metadata: {
            scope: tokens.scope,
          },
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id,provider" }
      );

    if (dbError) {
      throw new Error("Failed to save Shopify connection");
    }

    // Clear the state cookies
    const response = NextResponse.redirect(
      `${baseUrl}${safeReturnUrl}${safeReturnUrl.includes("?") ? "&" : "?"}success=${encodeURIComponent("Shopify connected successfully!")}`
    );
    response.cookies.delete("shopify_oauth_state");
    response.cookies.delete("shopify_shop");

    return response;
  } catch (error) {
    logError("Shopify Callback", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to connect Shopify";
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=${encodeURIComponent(errorMessage)}`
    );
  }
}
