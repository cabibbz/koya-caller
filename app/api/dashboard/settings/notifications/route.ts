/**
 * Notification Settings API Route
 * Session 18: Dashboard - Settings
 * Spec Reference: Part 7, Lines 792-798
 *
 * PUT /api/dashboard/settings/notifications
 * Updates: SMS and email notification preferences
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBusinessByUserId } from "@/lib/db/core";
import { withDashboardRateLimit } from "@/lib/rate-limit/middleware";

export const dynamic = "force-dynamic";

const VALID_REMINDER_SETTINGS = ["off", "1hr", "24hr"];

async function handler(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's business
    const business = await getBusinessByUserId(user.id);
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      // Owner SMS notifications
      smsAllCalls,
      smsBookings,
      smsMissed,
      smsMessages,
      smsUsageAlerts,
      // Owner email notifications
      emailDaily,
      emailWeekly,
      // Customer notifications
      smsCustomerConfirmation,
      smsCustomerReminder,
    } = body;

    // Validate reminder setting
    if (smsCustomerReminder && !VALID_REMINDER_SETTINGS.includes(smsCustomerReminder)) {
      return NextResponse.json(
        { error: "Invalid reminder setting. Must be: off, 1hr, or 24hr" },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      business_id: business.id,
    };

    // Owner SMS notifications
    if (smsAllCalls !== undefined) updateData.sms_all_calls = smsAllCalls;
    if (smsBookings !== undefined) updateData.sms_bookings = smsBookings;
    if (smsMissed !== undefined) updateData.sms_missed = smsMissed;
    if (smsMessages !== undefined) updateData.sms_messages = smsMessages;
    if (smsUsageAlerts !== undefined) updateData.sms_usage_alerts = smsUsageAlerts;

    // Owner email notifications
    if (emailDaily !== undefined) updateData.email_daily = emailDaily;
    if (emailWeekly !== undefined) updateData.email_weekly = emailWeekly;

    // Customer notifications
    if (smsCustomerConfirmation !== undefined) {
      updateData.sms_customer_confirmation = smsCustomerConfirmation;
    }
    if (smsCustomerReminder !== undefined) {
      updateData.sms_customer_reminder = smsCustomerReminder;
    }

    // Upsert notification settings
    const { data: notificationSettings, error: updateError } = await (supabase as any)
      .from("notification_settings")
      .upsert(updateData, { onConflict: "business_id" })
      .select()
      .single();

    if (updateError) {
      console.error("[Notifications API] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update notification settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: notificationSettings,
    });
  } catch (error) {
    console.error("[Notifications API] Error:", error);
    return NextResponse.json(
      { error: "Failed to update notification settings" },
      { status: 500 }
    );
  }
}

// Apply rate limiting
export const PUT = withDashboardRateLimit(handler);
