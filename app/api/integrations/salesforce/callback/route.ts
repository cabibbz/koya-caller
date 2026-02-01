/**
 * Salesforce OAuth Callback Route
 *
 * GET /api/integrations/salesforce/callback
 * Handles the OAuth callback from Salesforce
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;

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

  // Handle error from Salesforce
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
  const storedState = request.cookies.get("salesforce_oauth_state")?.value;
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
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/salesforce/callback`;
    const tokenResponse = await fetch("https://login.salesforce.com/services/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: SALESFORCE_CLIENT_ID!,
        client_secret: SALESFORCE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(errorData.error_description || "Failed to exchange authorization code");
    }

    const tokens = await tokenResponse.json();

    // Calculate token expiry (Salesforce tokens typically expire in 2 hours if issued_at is provided)
    // Salesforce returns issued_at in milliseconds
    const issuedAt = tokens.issued_at ? parseInt(tokens.issued_at, 10) : Date.now();
    // Default to 2 hours if no explicit expiry
    const expiresIn = tokens.expires_in || 7200;
    const expiresAt = new Date(issuedAt + expiresIn * 1000);

    // Store tokens in database
    const supabase = createAdminClient();
    // Type assertion needed since business_integrations is a new table
    const { error: dbError } = await (supabase as any)
      .from("business_integrations")
      .upsert(
        {
          business_id: businessId,
          provider: "salesforce",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          metadata: {
            instance_url: tokens.instance_url,
            id: tokens.id,
            token_type: tokens.token_type,
          },
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id,provider" }
      );

    if (dbError) {
      throw new Error("Failed to save Salesforce connection");
    }

    // Clear the state cookie
    const response = NextResponse.redirect(
      `${baseUrl}${safeReturnUrl}${safeReturnUrl.includes("?") ? "&" : "?"}success=${encodeURIComponent("Salesforce connected successfully!")}`
    );
    response.cookies.delete("salesforce_oauth_state");

    return response;
  } catch (error) {
    logError("Salesforce Callback", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to connect Salesforce";
    return NextResponse.redirect(
      `${baseUrl}/integrations?error=${encodeURIComponent(errorMessage)}`
    );
  }
}
