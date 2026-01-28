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
import crypto from "crypto";

export const dynamic = "force-dynamic";

function buildRedirect(baseUrl: string, returnUrl: string, params: Record<string, string>) {
  const separator = returnUrl.includes("?") ? "&" : "?";
  const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  return `${baseUrl}${returnUrl}${separator}${qs}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  let returnUrl = "/settings?tab=calendar";

  try {
    // Decode and verify state HMAC
    let businessId = "";
    if (state) {
      const decoded = JSON.parse(
        Buffer.from(state, "base64url").toString("utf-8")
      );

      // Verify HMAC signature
      const { hmac: receivedHmac, ...payload } = decoded;
      const stateSecret = process.env.NYLAS_WEBHOOK_SECRET || process.env.NEXTAUTH_SECRET || "fallback-state-secret";
      const expectedHmac = crypto.createHmac("sha256", stateSecret).update(JSON.stringify(payload)).digest("hex");

      if (!receivedHmac || receivedHmac !== expectedHmac) {
        logError("Nylas Callback", "Invalid state HMAC — possible CSRF");
        return NextResponse.redirect(buildRedirect(baseUrl, returnUrl, { calendar_error: "invalid_state" }));
      }

      // Verify timestamp (15-minute expiry)
      const STATE_MAX_AGE_MS = 15 * 60 * 1000;
      if (payload.timestamp && Date.now() - payload.timestamp > STATE_MAX_AGE_MS) {
        logError("Nylas Callback", "Expired OAuth state");
        return NextResponse.redirect(buildRedirect(baseUrl, returnUrl, { calendar_error: "expired_state" }));
      }

      businessId = decoded.businessId;
      returnUrl = decoded.returnUrl || returnUrl;
    }

    if (error) {
      logError("Nylas Callback", `OAuth error: ${error}`);
      return NextResponse.redirect(buildRedirect(baseUrl, returnUrl, { calendar_error: error }));
    }

    if (!code || !businessId) {
      return NextResponse.redirect(buildRedirect(baseUrl, returnUrl, { calendar_error: "missing_params" }));
    }

    // Exchange code for token/grant
    const nylas = getNylasClient();
    logInfo("Nylas Callback", `Exchanging code for token, redirectUri=${NYLAS_REDIRECT_URI}`);
    const response = await nylas.auth.exchangeCodeForToken({
      clientId: NYLAS_CLIENT_ID,
      redirectUri: NYLAS_REDIRECT_URI,
      code,
    });

    const grantId = response.grantId;
    const email = response.email || "";
    logInfo("Nylas Callback", `Got grantId=${grantId}, email=${email}`);

    // Determine provider from the grant
    let provider = "google";
    try {
      const grantInfo = await nylas.grants.find({ grantId });
      provider = grantInfo.data.provider || "google";
      logInfo("Nylas Callback", `Provider: ${provider}`);
    } catch (provErr: any) {
      logError("Nylas Callback", `Could not determine provider: ${provErr?.message}`);
    }

    // Store the grant in our database
    logInfo("Nylas Callback", `Storing grant for business ${businessId}`);
    await storeNylasGrant(businessId, grantId, email, provider);
    logInfo("Nylas Callback", `Grant stored successfully`);

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

    return NextResponse.redirect(buildRedirect(baseUrl, returnUrl, { calendar_connected: "true" }));
  } catch (err: any) {
    logError("Nylas Callback", `Exchange failed: ${err?.message || err}`);
    if (err?.statusCode) logError("Nylas Callback", `Status: ${err.statusCode}, Body: ${JSON.stringify(err.body || err.response?.body)}`);
    return NextResponse.redirect(buildRedirect(baseUrl, returnUrl, { calendar_error: "exchange_failed" }));
  }
}
