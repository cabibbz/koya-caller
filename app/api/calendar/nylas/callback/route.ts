/**
 * Nylas OAuth Callback
 * GET /api/calendar/nylas/callback
 *
 * Handles the OAuth redirect from Nylas, exchanges code for grant
 */

import { NextRequest, NextResponse } from "next/server";
import { getNylasClient, NYLAS_CLIENT_ID, NYLAS_REDIRECT_URI } from "@/lib/nylas/client";
import { storeNylasGrant, listCalendars } from "@/lib/nylas/calendar";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError, logInfo } from "@/lib/logging";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  let returnUrl = "/settings?tab=calendar";

  try {
    // Decode state
    let businessId = "";
    if (state) {
      const decoded = JSON.parse(
        Buffer.from(state, "base64url").toString("utf-8")
      );
      businessId = decoded.businessId;
      returnUrl = decoded.returnUrl || returnUrl;
    }

    if (error) {
      logError("Nylas Callback", `OAuth error: ${error}`);
      return NextResponse.redirect(
        `${baseUrl}${returnUrl}&calendar_error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !businessId) {
      return NextResponse.redirect(
        `${baseUrl}${returnUrl}&calendar_error=missing_params`
      );
    }

    // Exchange code for token/grant
    const nylas = getNylasClient();
    const response = await nylas.auth.exchangeCodeForToken({
      clientId: NYLAS_CLIENT_ID,
      redirectUri: NYLAS_REDIRECT_URI,
      code,
      codeVerifier: "",
    });

    const grantId = response.grantId;
    const email = response.email || "";

    // Determine provider from the grant
    // Nylas returns provider info in the grant
    let provider = "google";
    try {
      const grantInfo = await nylas.grants.find({ grantId });
      provider = grantInfo.data.provider || "google";
    } catch {
      // Default to google if we can't determine
    }

    // Store the grant in our database
    await storeNylasGrant(businessId, grantId, email, provider);

    // Fetch and store primary calendar ID
    try {
      const calendars = await listCalendars(grantId);
      const primaryCal = calendars.find((c: any) => c.isPrimary) || calendars[0];
      if (primaryCal) {
        const supabase = createAdminClient();
        await (supabase as any)
          .from("calendar_integrations")
          .update({ nylas_calendar_id: primaryCal.id })
          .eq("business_id", businessId);
      }
    } catch (calErr) {
      logError("Nylas Callback", `Failed to fetch calendars: ${calErr}`);
    }

    logInfo("Nylas Callback", `Connected ${provider} calendar for business ${businessId}`);

    return NextResponse.redirect(
      `${baseUrl}${returnUrl}&calendar_connected=true`
    );
  } catch (err) {
    logError("Nylas Callback", err);
    return NextResponse.redirect(
      `${baseUrl}${returnUrl}&calendar_error=exchange_failed`
    );
  }
}
