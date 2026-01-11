/**
 * Google Calendar OAuth Callback Route
 * Session 20: Calendar Integration
 * 
 * GET /api/calendar/google/callback
 * Handles the OAuth callback from Google
 */

import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode, parseOAuthState, storeCalendarTokens } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Base URL for redirects
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Handle error from Google
  if (error) {
    const errorDescription = searchParams.get("error_description") || "Authorization was denied";
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=calendar&error=${encodeURIComponent(errorDescription)}`
    );
  }

  // Validate code exists
  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=calendar&error=${encodeURIComponent("Missing authorization code")}`
    );
  }

  // Validate state exists
  if (!state) {
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=calendar&error=${encodeURIComponent("Invalid request state")}`
    );
  }

  // Validate state matches cookie
  const storedState = request.cookies.get("google_oauth_state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=calendar&error=${encodeURIComponent("Invalid request state")}`
    );
  }

  // Parse state to get business ID and return URL
  const stateData = parseOAuthState(state);
  if (!stateData) {
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=calendar&error=${encodeURIComponent("Invalid or expired request")}`
    );
  }

  const { businessId, returnUrl } = stateData;

  try {
    // Exchange code for tokens
    const tokens = await exchangeGoogleCode(code);

    // Store tokens in database
    await storeCalendarTokens(businessId, "google", tokens);

    // Clear the state cookie
    const response = NextResponse.redirect(
      `${baseUrl}${returnUrl}?success=${encodeURIComponent("Google Calendar connected successfully!")}`
    );
    response.cookies.delete("google_oauth_state");

    return response;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to connect calendar";
    return NextResponse.redirect(
      `${baseUrl}/settings?tab=calendar&error=${encodeURIComponent(errorMessage)}`
    );
  }
}
