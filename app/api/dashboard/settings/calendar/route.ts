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

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";

export const dynamic = "force-dynamic";

const VALID_PROVIDERS = ["google", "outlook", "built_in"];

async function handleGET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { data: calendarIntegration } = await (supabase as any)
      .from("calendar_integrations")
      .select("*")
      .eq("business_id", business.id)
      .single();

    // Determine if calendar is connected
    const isConnected =
      calendarIntegration?.provider &&
      calendarIntegration.provider !== "built_in" &&
      !!calendarIntegration.access_token;

    // Check if token is expired (for display purposes)
    const tokenExpired =
      calendarIntegration?.token_expires_at &&
      new Date(calendarIntegration.token_expires_at) < new Date();

    return NextResponse.json({
      success: true,
      data: calendarIntegration || {
        provider: "built_in",
        connected: false,
        default_duration_minutes: 60,
        buffer_minutes: 0,
        advance_booking_days: 14,
        require_email: false,
      },
      connected: isConnected && !tokenExpired,
      tokenExpired: isConnected && tokenExpired,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch calendar settings" },
      { status: 500 }
    );
  }
}

async function handlePUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      defaultDurationMinutes,
      bufferMinutes,
      advanceBookingDays,
      requireEmail,
    } = body;

    // Update calendar settings
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
      return NextResponse.json(
        { error: "Failed to update calendar settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: calendarIntegration,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update calendar settings" },
      { status: 500 }
    );
  }
}

async function handlePOST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const body = await request.json();
    const { provider, returnUrl } = body;

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: "Invalid provider. Must be: google, outlook, or built_in" },
        { status: 400 }
      );
    }

    // Handle Google OAuth - redirect to dedicated auth endpoint
    if (provider === "google") {
      // Check if Google credentials are configured
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return NextResponse.json({
          success: false,
          message: "Google Calendar is not configured. Please contact support.",
          oauthUrl: null,
        });
      }

      // Return the OAuth initiation endpoint
      return NextResponse.json({
        success: true,
        provider: "google",
        initiateUrl: "/api/calendar/google/auth",
        returnUrl: returnUrl || "/settings?tab=calendar",
      });
    }

    // Handle Outlook OAuth - redirect to dedicated auth endpoint
    if (provider === "outlook") {
      // Check if Azure credentials are configured
      if (!process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET) {
        return NextResponse.json({
          success: false,
          message: "Outlook Calendar is not configured. Please contact support.",
          oauthUrl: null,
        });
      }

      // Return the OAuth initiation endpoint
      return NextResponse.json({
        success: true,
        provider: "outlook",
        initiateUrl: "/api/calendar/outlook/auth",
        returnUrl: returnUrl || "/settings?tab=calendar",
      });
    }

    // Switch to built-in calendar
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
      return NextResponse.json(
        { error: "Failed to update calendar provider" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: calendarIntegration,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to initiate calendar connection" },
      { status: 500 }
    );
  }
}

async function handleDELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Reset to built-in calendar
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
      return NextResponse.json(
        { error: "Failed to disconnect calendar" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Calendar disconnected",
      data: calendarIntegration,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to disconnect calendar" },
      { status: 500 }
    );
  }
}

// Apply rate limiting to all methods
export const GET = withDashboardRateLimit(handleGET);
export const PUT = withDashboardRateLimit(handlePUT);
export const POST = withDashboardRateLimit(handlePOST);
export const DELETE = withDashboardRateLimit(handleDELETE);
