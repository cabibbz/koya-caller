/**
 * Calendar Settings API Route
 * Session 18: Dashboard - Settings
 * Spec Reference: Part 7, Lines 780-790
 *
 * GET /api/dashboard/settings/calendar - Get calendar settings
 * PUT /api/dashboard/settings/calendar - Update calendar settings
 * POST /api/dashboard/settings/calendar - Initiate OAuth flow (stub)
 * DELETE /api/dashboard/settings/calendar - Disconnect calendar
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { logError, logInfo } from "@/lib/logging";
import { sendCalendarDisconnectEmail } from "@/lib/email";
import { getDashboardUrl } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const VALID_PROVIDERS = ["google", "outlook", "built_in"];

async function handleGet(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: calendarIntegration } = await (supabase as any)
      .from("calendar_integrations")
      .select("*")
      .eq("business_id", business.id)
      .single();

    // Determine if calendar is connected (check both Nylas grant and legacy tokens)
    const hasNylasGrant = !!calendarIntegration?.grant_id && calendarIntegration.grant_status === "active";
    const hasLegacyToken = !!calendarIntegration?.access_token;
    const isConnected =
      calendarIntegration?.provider &&
      calendarIntegration.provider !== "built_in" &&
      (hasNylasGrant || hasLegacyToken);

    // Check if legacy token is expired (Nylas handles its own token refresh)
    const tokenExpired = !hasNylasGrant &&
      calendarIntegration?.token_expires_at &&
      new Date(calendarIntegration.token_expires_at) < new Date();

    return success({
      ...(calendarIntegration || {
        provider: "built_in",
        connected: false,
        default_duration_minutes: 60,
        buffer_minutes: 0,
        advance_booking_days: 14,
        require_email: false,
      }),
      connected: isConnected && !tokenExpired,
      tokenExpired: isConnected && tokenExpired,
    });
  } catch (error) {
    logError("Settings Calendar GET", error);
    return errors.internalError("Failed to fetch calendar settings");
  }
}

async function handlePut(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { defaultDurationMinutes, bufferMinutes, advanceBookingDays, requireEmail } = body;

    // Update calendar settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: calendarIntegration, error: updateError } = await (supabase as any)
      .from("calendar_integrations")
      .upsert(
        {
          business_id: business.id,
          provider: "built_in",
          default_duration_minutes: defaultDurationMinutes || 60,
          buffer_minutes: bufferMinutes || 0,
          advance_booking_days: advanceBookingDays || 14,
          require_email: requireEmail ?? false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      )
      .select()
      .single();

    if (updateError) {
      return errors.internalError("Failed to update calendar settings");
    }

    return success(calendarIntegration);
  } catch (error) {
    logError("Settings Calendar PUT", error);
    return errors.internalError("Failed to update calendar settings");
  }
}

async function handlePost(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { provider, returnUrl } = body;

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return errors.badRequest("Invalid provider. Must be: google, outlook, or built_in");
    }

    // Google and Outlook are now handled via Nylas OAuth
    if (provider === "google" || provider === "outlook") {
      if (!process.env.NYLAS_API_KEY) {
        return success({
          configured: false,
          message: "Calendar integration is not configured. Please contact support.",
          oauthUrl: null,
        });
      }

      // Route through Nylas OAuth initiation
      return success({
        provider,
        initiateUrl: "/api/calendar/nylas/auth",
        returnUrl: returnUrl || "/settings?tab=calendar",
      });
    }

    // Switch to built-in calendar
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: calendarIntegration, error: updateError } = await (supabase as any)
      .from("calendar_integrations")
      .upsert(
        {
          business_id: business.id,
          provider: "built_in",
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
          calendar_id: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      )
      .select()
      .single();

    if (updateError) {
      return errors.internalError("Failed to update calendar provider");
    }

    return success(calendarIntegration);
  } catch (error) {
    logError("Settings Calendar POST", error);
    return errors.internalError("Failed to initiate calendar connection");
  }
}

async function handleDelete(
  _request: NextRequest,
  { business, supabase, user }: BusinessAuthContext
) {
  try {
    // Get current provider before disconnecting (for email notification)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: existingIntegration } = await (supabase as any)
      .from("calendar_integrations")
      .select("provider")
      .eq("business_id", business.id)
      .single();

    const previousProvider = existingIntegration?.provider;

    // Reset to built-in calendar — clear both legacy tokens and Nylas grant
    // Use admin client to bypass RLS for Nylas grant columns
    const adminClient = createAdminClient() as any;
    const { data: calendarIntegration, error: updateError } = await adminClient
      .from("calendar_integrations")
      .upsert(
        {
          business_id: business.id,
          provider: "built_in",
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
          calendar_id: null,
          grant_id: null,
          grant_email: null,
          grant_provider: null,
          grant_status: "revoked",
          nylas_calendar_id: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "business_id" }
      )
      .select()
      .single();

    if (updateError) {
      logError("Calendar DELETE upsert", updateError);
      return errors.internalError("Failed to disconnect calendar");
    }

    logInfo("Calendar DELETE", `Disconnected ${previousProvider} for business ${business.id}`);

    // Send email notification if disconnecting from Google or Outlook
    if (previousProvider === "google" || previousProvider === "outlook") {
      await sendCalendarDisconnectEmail({
        to: user.email || "",
        businessName: business.name,
        provider: previousProvider,
        reason: "manual",
        reconnectUrl: getDashboardUrl("/settings?tab=calendar"),
      }).catch((emailError) => {
        // Log but don't fail the request if email fails
        logError("Calendar disconnect email", emailError);
      });
    }

    return success({
      message: "Calendar disconnected",
      ...calendarIntegration,
    });
  } catch (error) {
    logError("Settings Calendar DELETE", error);
    return errors.internalError("Failed to disconnect calendar");
  }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
export const POST = withAuth(handlePost);
export const DELETE = withAuth(handleDelete);
