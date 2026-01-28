/**
 * Mindbody OAuth Initiation Route
 *
 * POST /api/integrations/mindbody/auth
 * Initiates the Mindbody OAuth flow
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

const MINDBODY_CLIENT_ID = process.env.MINDBODY_CLIENT_ID;
const MINDBODY_SCOPES = "offline_access Mindbody.Api.Public.v6";

/**
 * Generate a secure state token for OAuth
 */
function generateOAuthState(businessId: string, returnUrl: string, siteId: string): string {
  const nonce = crypto.randomUUID();
  const state = {
    businessId,
    returnUrl,
    siteId,
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

    // Check if Mindbody is configured
    if (!MINDBODY_CLIENT_ID) {
      return NextResponse.json(
        { error: "Mindbody integration is not configured. Please contact support." },
        { status: 503 }
      );
    }

    // Get return URL and site ID from request body
    const body = await request.json().catch(() => ({}));
    const returnUrl = body.returnUrl || "/integrations";
    const siteId = body.siteId;

    if (!siteId) {
      return NextResponse.json(
        { error: "Mindbody Site ID is required" },
        { status: 400 }
      );
    }

    // Generate state token (includes siteId for callback)
    const state = generateOAuthState(business.id, returnUrl, siteId);

    // Build authorization URL
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/mindbody/callback`;
    const authUrl = `https://auth.mindbodyonline.com/connect/authorize?` +
      new URLSearchParams({
        client_id: MINDBODY_CLIENT_ID,
        scope: MINDBODY_SCOPES,
        redirect_uri: redirectUri,
        response_type: "code",
        state,
      }).toString();

    // Set state in a secure cookie for validation on callback
    const response = NextResponse.json({
      success: true,
      authUrl,
    });

    response.cookies.set("mindbody_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    logError("Mindbody Auth", error);
    return NextResponse.json(
      { error: "Failed to initiate Mindbody connection" },
      { status: 500 }
    );
  }
}

export const POST = withDashboardRateLimit(handlePOST);
