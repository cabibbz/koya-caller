/**
 * Square OAuth Initiation Route
 *
 * POST /api/integrations/square/auth
 * Initiates the Square OAuth flow
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

const SQUARE_CLIENT_ID = process.env.SQUARE_CLIENT_ID;
const SQUARE_SCOPES = [
  "ITEMS_READ",
  "INVENTORY_READ",
  "ORDERS_READ",
  "CUSTOMERS_READ",
].join(" ");

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

    // Check if Square is configured
    if (!SQUARE_CLIENT_ID) {
      return NextResponse.json(
        { error: "Square integration is not configured. Please contact support." },
        { status: 503 }
      );
    }

    // Get return URL from request body
    const body = await request.json().catch(() => ({}));
    const returnUrl = body.returnUrl || "/integrations";

    // Generate state token
    const state = generateOAuthState(business.id, returnUrl);

    // Build authorization URL
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/square/callback`;
    const authUrl = `https://connect.squareup.com/oauth2/authorize?` +
      new URLSearchParams({
        client_id: SQUARE_CLIENT_ID,
        scope: SQUARE_SCOPES,
        redirect_uri: redirectUri,
        state,
        session: "false",
      }).toString();

    // Set state in a secure cookie for validation on callback
    const response = NextResponse.json({
      success: true,
      authUrl,
    });

    response.cookies.set("square_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    logError("Square Auth", error);
    return NextResponse.json(
      { error: "Failed to initiate Square connection" },
      { status: 500 }
    );
  }
}

export const POST = withDashboardRateLimit(handlePOST);
