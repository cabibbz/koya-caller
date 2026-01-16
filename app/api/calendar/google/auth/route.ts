/**
 * Google Calendar OAuth Initiation Route
 * Session 20: Calendar Integration
 * 
 * POST /api/calendar/google/auth
 * Initiates the Google OAuth flow by returning the authorization URL
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";
import { getGoogleAuthUrl, generateOAuthState } from "@/lib/calendar";

export const dynamic = "force-dynamic";

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

    // Get return URL from request body
    const body = await request.json().catch(() => ({}));
    const returnUrl = body.returnUrl || "/settings?tab=calendar";

    // Generate state token
    const state = generateOAuthState(business.id, returnUrl);

    // Generate authorization URL
    let authUrl: string;
    try {
      authUrl = getGoogleAuthUrl(state);
    } catch (_error) {
      return NextResponse.json(
        { error: "Google Calendar is not configured. Please contact support." },
        { status: 503 }
      );
    }

    // Set state in a secure cookie for validation on callback
    const response = NextResponse.json({
      success: true,
      authUrl,
    });

    // Store state in cookie (HTTPOnly, Secure in production)
    response.cookies.set("google_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    });

    return response;
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to initiate Google Calendar connection" },
      { status: 500 }
    );
  }
}

export const POST = withDashboardRateLimit(handlePOST);
