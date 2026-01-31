/**
 * Calendar Settings API Route
 * Session 18: Dashboard - Settings
 * Spec Reference: Part 7, Lines 780-790
 *
 * GET /api/dashboard/settings/calendar - Get ALL connected calendars
 * PUT /api/dashboard/settings/calendar - Update calendar settings
 * POST /api/dashboard/settings/calendar - Initiate OAuth flow / Set primary
 * DELETE /api/dashboard/settings/calendar - Disconnect calendar (specific provider or all)
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
import {
  getCalendarIntegrations,
  disconnectNylasGrant,
  setPrimaryCalendar,
} from "@/lib/nylas/calendar";

export const dynamic = "force-dynamic";

const VALID_PROVIDERS = ["google", "outlook", "built_in"];

async function handleGet(
  _request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const adminClient = createAdminClient() as any;

    // Get ALL calendar integrations for this business
    const { data: integrations, error } = await adminClient
      .from("calendar_integrations")
      .select("*")
      .eq("business_id", business.id)
      .not("grant_id", "is", null)
      .eq("grant_status", "active");

    if (error) {
      logError("Settings Calendar GET", error);
    }

    // Also get any built_in record for settings
    const { data: builtInRecord } = await adminClient
      .from("calendar_integrations")
      .select("default_duration_minutes, buffer_minutes, advance_booking_days, require_email")
      .eq("business_id", business.id)
      .eq("provider", "built_in")
      .single();

    // Format connected calendars
    const connectedCalendars = (integrations || []).map((cal: any) => ({
      id: cal.id,
      provider: cal.provider,
      email: cal.grant_email,
      isPrimary: cal.is_primary || false,
      connectedAt: cal.created_at,
    }));

    return success({
      calendars: connectedCalendars,
      hasConnectedCalendar: connectedCalendars.length > 0,
      // Booking settings (from built_in record or defaults)
      settings: {
        default_duration_minutes: builtInRecord?.default_duration_minutes || 60,
        buffer_minutes: builtInRecord?.buffer_minutes || 0,
        advance_booking_days: builtInRecord?.advance_booking_days || 14,
        require_email: builtInRecord?.require_email || false,
      },
    });
  } catch (error) {
    logError("Settings Calendar GET", error);
    return errors.internalError("Failed to fetch calendar settings");
  }
}

async function handlePut(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { defaultDurationMinutes, bufferMinutes, advanceBookingDays, requireEmail } = body;

    const adminClient = createAdminClient() as any;

    // Update or create built_in record for settings
    const { data: settings, error: updateError } = await adminClient
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
        { onConflict: "business_id,provider" }
      )
      .select()
      .single();

    if (updateError) {
      logError("Settings Calendar PUT", updateError);
      return errors.internalError("Failed to update calendar settings");
    }

    return success({
      message: "Settings updated",
      settings: {
        default_duration_minutes: settings.default_duration_minutes,
        buffer_minutes: settings.buffer_minutes,
        advance_booking_days: settings.advance_booking_days,
        require_email: settings.require_email,
      },
    });
  } catch (error) {
    logError("Settings Calendar PUT", error);
    return errors.internalError("Failed to update calendar settings");
  }
}

async function handlePost(
  request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const body = await request.json();
    const { provider, returnUrl, action } = body;

    // Set primary calendar action
    if (action === "setPrimary" && provider) {
      await setPrimaryCalendar(business.id, provider);
      return success({ message: `${provider} set as primary calendar` });
    }

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

    return success({ message: "Use initiateUrl for OAuth providers" });
  } catch (error) {
    logError("Settings Calendar POST", error);
    return errors.internalError("Failed to initiate calendar connection");
  }
}

async function handleDelete(
  request: NextRequest,
  { business, user }: BusinessAuthContext
) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider"); // Optional: disconnect specific provider

    if (provider) {
      // Disconnect specific provider
      await disconnectNylasGrant(business.id, provider);

      logInfo("Calendar DELETE", `Disconnected ${provider} for business ${business.id}`);

      // Send email notification
      if (provider === "google" || provider === "outlook" || provider === "microsoft") {
        await sendCalendarDisconnectEmail({
          to: user.email || "",
          businessName: business.name,
          provider: provider === "microsoft" ? "outlook" : provider,
          reason: "manual",
          reconnectUrl: getDashboardUrl("/settings?tab=calendar"),
        }).catch((emailError) => {
          logError("Calendar disconnect email", emailError);
        });
      }

      return success({
        message: `${provider} calendar disconnected`,
        provider,
      });
    } else {
      // Disconnect ALL calendars
      await disconnectNylasGrant(business.id);

      logInfo("Calendar DELETE", `Disconnected all calendars for business ${business.id}`);

      return success({
        message: "All calendars disconnected",
      });
    }
  } catch (error) {
    logError("Settings Calendar DELETE", error);
    return errors.internalError("Failed to disconnect calendar");
  }
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut);
export const POST = withAuth(handlePost);
export const DELETE = withAuth(handleDelete);
