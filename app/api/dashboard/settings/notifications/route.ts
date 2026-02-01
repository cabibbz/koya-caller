/**
 * Notification Settings API Route
 * Session 18: Dashboard - Settings
 * Spec Reference: Part 7, Lines 792-798
 *
 * PUT /api/dashboard/settings/notifications
 * Updates: SMS and email notification preferences
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

const VALID_REMINDER_SETTINGS = ["off", "1hr", "24hr"];

async function handlePut(
  request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
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
      emailMissed,
      // Customer notifications
      smsCustomerConfirmation,
      smsCustomerReminder,
    } = body;

    // Validate reminder setting
    if (smsCustomerReminder && !VALID_REMINDER_SETTINGS.includes(smsCustomerReminder)) {
      return errors.badRequest("Invalid reminder setting. Must be: off, 1hr, or 24hr");
    }

    // Helper to validate boolean fields
    const validateBoolean = (value: unknown, fieldName: string): boolean | null => {
      if (value === undefined) return null;
      if (typeof value !== "boolean") {
        throw new Error(`${fieldName} must be a boolean`);
      }
      return value;
    };

    // Build update object with type validation
    const updateData: Record<string, unknown> = {
      business_id: business.id,
    };

    try {
      // Owner SMS notifications
      const validatedSmsAllCalls = validateBoolean(smsAllCalls, "smsAllCalls");
      const validatedSmsBookings = validateBoolean(smsBookings, "smsBookings");
      const validatedSmsMissed = validateBoolean(smsMissed, "smsMissed");
      const validatedSmsMessages = validateBoolean(smsMessages, "smsMessages");
      const validatedSmsUsageAlerts = validateBoolean(smsUsageAlerts, "smsUsageAlerts");
      const validatedEmailDaily = validateBoolean(emailDaily, "emailDaily");
      const validatedEmailWeekly = validateBoolean(emailWeekly, "emailWeekly");
      const validatedEmailMissed = validateBoolean(emailMissed, "emailMissed");
      const validatedSmsCustomerConfirmation = validateBoolean(smsCustomerConfirmation, "smsCustomerConfirmation");

      if (validatedSmsAllCalls !== null) updateData.sms_all_calls = validatedSmsAllCalls;
      if (validatedSmsBookings !== null) updateData.sms_bookings = validatedSmsBookings;
      if (validatedSmsMissed !== null) updateData.sms_missed = validatedSmsMissed;
      if (validatedSmsMessages !== null) updateData.sms_messages = validatedSmsMessages;
      if (validatedSmsUsageAlerts !== null) updateData.sms_usage_alerts = validatedSmsUsageAlerts;
      if (validatedEmailDaily !== null) updateData.email_daily = validatedEmailDaily;
      if (validatedEmailWeekly !== null) updateData.email_weekly = validatedEmailWeekly;
      if (validatedEmailMissed !== null) updateData.email_missed = validatedEmailMissed;
      if (validatedSmsCustomerConfirmation !== null) updateData.sms_customer_confirmation = validatedSmsCustomerConfirmation;
    } catch (validationError) {
      return errors.badRequest((validationError as Error).message);
    }

    // Customer reminder (already validated above for valid values)
    if (smsCustomerReminder !== undefined) {
      updateData.sms_customer_reminder = smsCustomerReminder;
    }

    // Upsert notification settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: notificationSettings, error: updateError } = await (supabase as any)
      .from("notification_settings")
      .upsert(updateData, { onConflict: "business_id" })
      .select()
      .single();

    if (updateError) {
      return errors.internalError("Failed to update notification settings");
    }

    return success(notificationSettings);
  } catch (error) {
    logError("Settings Notifications PUT", error);
    return errors.internalError("Failed to update notification settings");
  }
}

// Apply auth middleware with rate limiting
export const PUT = withAuth(handlePut);
