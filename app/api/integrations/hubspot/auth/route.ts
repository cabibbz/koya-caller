/**
 * HubSpot OAuth Initiation Route
 *
 * POST /api/integrations/hubspot/auth
 * Initiates the HubSpot OAuth flow
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

const HUBSPOT_CLIENT_ID = process.env.HUBSPOT_CLIENT_ID;
const HUBSPOT_SCOPES = [
  "crm.objects.contacts.write",
  "crm.objects.contacts.read",
  "crm.objects.deals.write",
  "crm.objects.deals.read",
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

    // Check if HubSpot is configured
    if (!HUBSPOT_CLIENT_ID) {
      return NextResponse.json(
        { error: "HubSpot integration is not configured. Please contact support." },
        { status: 503 }
      );
    }

    // Get return URL from request body
    const body = await request.json().catch(() => ({}));
    const returnUrl = body.returnUrl || "/integrations";

    // Generate state token
    const state = generateOAuthState(business.id, returnUrl);

    // Build authorization URL
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/hubspot/callback`;
    const authUrl = `https://app.hubspot.com/oauth/authorize?` +
      new URLSearchParams({
        client_id: HUBSPOT_CLIENT_ID,
        scope: HUBSPOT_SCOPES,
        redirect_uri: redirectUri,
        state,
      }).toString();

    // Set state in a secure cookie for validation on callback
    const response = NextResponse.json({
      success: true,
      authUrl,
    });

    response.cookies.set("hubspot_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    logError("HubSpot Auth", error);
    return NextResponse.json(
      { error: "Failed to initiate HubSpot connection" },
      { status: 500 }
    );
  }
}

export const POST = withDashboardRateLimit(handlePOST);
