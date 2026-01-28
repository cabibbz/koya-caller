/**
 * Stripe Connect OAuth Callback Route
 *
 * GET /api/integrations/stripe_connect/callback
 * Handles the OAuth callback from Stripe Connect
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

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
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Base URL for redirects
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Handle error from Stripe
  if (error) {
    const message = errorDescription || "Authorization was denied";
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=${encodeURIComponent(message)}`
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=${encodeURIComponent("Missing required parameters")}`
    );
  }

  // Validate state matches cookie
  const storedState = request.cookies.get("stripe_connect_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=${encodeURIComponent("Invalid request state")}`
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
    // Exchange code for access token using Stripe SDK
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
      apiVersion: "2025-02-24.acacia",
    });

    const response = await stripe.oauth.token({
      grant_type: "authorization_code",
      code,
    });

    // Store tokens in database
    const supabase = createAdminClient();
    // Type assertion needed since business_integrations is a new table
    const { error: dbError } = await (supabase as any)
      .from("business_integrations")
      .upsert(
        {
          business_id: businessId,
          provider: "stripe_connect",
          access_token: response.access_token,
          refresh_token: response.refresh_token,
          account_id: response.stripe_user_id,
          metadata: {
            scope: response.scope,
            livemode: response.livemode,
          },
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id,provider" }
      );

    if (dbError) {
      throw new Error("Failed to save Stripe connection");
    }

    // Clear the state cookie
    const redirectResponse = NextResponse.redirect(
      `${baseUrl}${safeReturnUrl}${safeReturnUrl.includes("?") ? "&" : "?"}success=${encodeURIComponent("Stripe connected successfully!")}`
    );
    redirectResponse.cookies.delete("stripe_connect_oauth_state");

    return redirectResponse;
  } catch (error) {
    logError("Stripe Connect Callback", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to connect Stripe";
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=${encodeURIComponent(errorMessage)}`
    );
  }
}
