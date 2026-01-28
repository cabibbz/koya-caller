/**
 * HubSpot OAuth Callback Route
 *
 * GET /api/integrations/hubspot/callback
 * Handles the OAuth callback from HubSpot
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_CLIENT_SECRET = process.env.HUBSPOT_CLIENT_SECRET;

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

  // Handle error from HubSpot
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
  const storedState = request.cookies.get("hubspot_oauth_state")?.value;
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
    // Exchange code for access token
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/hubspot/callback`;
    const tokenResponse = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: HUBSPOT_CLIENT_ID!,
        client_secret: HUBSPOT_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(errorData.message || "Failed to exchange authorization code");
    }

    const tokens = await tokenResponse.json();

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Store tokens in database
    const supabase = createAdminClient();
    // Type assertion needed since business_integrations is a new table
    const { error: dbError } = await (supabase as any)
      .from("business_integrations")
      .upsert(
        {
          business_id: businessId,
          provider: "hubspot",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          metadata: {
            hub_id: tokens.hub_id,
            hub_domain: tokens.hub_domain,
          },
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id,provider" }
      );

    if (dbError) {
      throw new Error("Failed to save HubSpot connection");
    }

    // Clear the state cookie
    const response = NextResponse.redirect(
      `${baseUrl}${safeReturnUrl}${safeReturnUrl.includes("?") ? "&" : "?"}success=${encodeURIComponent("HubSpot connected successfully!")}`
    );
    response.cookies.delete("hubspot_oauth_state");

    return response;
  } catch (error) {
    logError("HubSpot Callback", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to connect HubSpot";
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=${encodeURIComponent(errorMessage)}`
    );
  }
}
