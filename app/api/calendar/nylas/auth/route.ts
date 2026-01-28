/**
 * Nylas OAuth Initiation
 * POST /api/calendar/nylas/auth
 *
 * Redirects the business owner to Nylas hosted auth to connect their calendar
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { getNylasClient, NYLAS_CLIENT_ID, NYLAS_REDIRECT_URI } from "@/lib/nylas/client";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

async function handlePost(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const body = await request.json().catch(() => ({}));
    const returnUrl = body.returnUrl || "/settings?tab=calendar";
    const providerHint = body.provider; // optional: "google" or "microsoft"

    // Encode state with business ID and return URL
    const state = Buffer.from(
      JSON.stringify({
        businessId: business.id,
        returnUrl,
      })
    ).toString("base64url");

    const nylas = getNylasClient();
    const authUrl = nylas.auth.urlForOAuth2({
      clientId: NYLAS_CLIENT_ID,
      redirectUri: NYLAS_REDIRECT_URI,
      state,
      ...(providerHint ? { provider: providerHint } : {}),
    });

    return success({ authUrl });
  } catch (error) {
    logError("Nylas Auth", error);
    return errors.internalError("Failed to generate Nylas auth URL");
  }
}

export const POST = withAuth(handlePost);
