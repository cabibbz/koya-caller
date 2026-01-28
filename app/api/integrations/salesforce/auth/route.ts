/**
 * Salesforce OAuth Initiation Route
 *
 * POST /api/integrations/salesforce/auth
 * Initiates the Salesforce OAuth flow
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SALESFORCE_SCOPES = ["api", "refresh_token"].join(" ");

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

    // Check if Salesforce is configured
    if (!SALESFORCE_CLIENT_ID) {
      return NextResponse.json(
        { error: "Salesforce integration is not configured. Please contact support." },
        { status: 503 }
      );
    }

    // Get return URL from request body
    const body = await request.json().catch(() => ({}));
    const returnUrl = body.returnUrl || "/integrations";

    // Generate state token
    const state = generateOAuthState(business.id, returnUrl);

    // Build authorization URL
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/salesforce/callback`;
    const authUrl = `https://login.salesforce.com/services/oauth2/authorize?` +
      new URLSearchParams({
        response_type: "code",
        client_id: SALESFORCE_CLIENT_ID,
        scope: SALESFORCE_SCOPES,
        redirect_uri: redirectUri,
        state,
      }).toString();

    // Set state in a secure cookie for validation on callback
    const response = NextResponse.json({
      success: true,
      authUrl,
    });

    response.cookies.set("salesforce_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    logError("Salesforce Auth", error);
    return NextResponse.json(
      { error: "Failed to initiate Salesforce connection" },
      { status: 500 }
    );
  }
}

export const POST = withDashboardRateLimit(handlePOST);
