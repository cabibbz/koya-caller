/**
 * Settings API Route
 * Session 18: Dashboard - Settings
 * Spec Reference: Part 7, Lines 748-810
 *
 * GET /api/dashboard/settings
 * Returns: All settings data for the settings page
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

async function handleGet(
  _request: NextRequest,
  { business, supabase }: BusinessAuthContext
) {
  try {
    // Fetch all settings data in parallel
    const [
      { data: callSettings },
      { data: aiConfig },
      { data: calendarIntegration },
      { data: notificationSettings },
      { data: phoneNumbers },
    ] = await Promise.all([
      supabase
        .from("call_settings")
        .select("*")
        .eq("business_id", business.id)
        .single(),
      supabase
        .from("ai_config")
        .select("*")
        .eq("business_id", business.id)
        .single(),
      supabase
        .from("calendar_integrations")
        .select("*")
        .eq("business_id", business.id)
        .single(),
      supabase
        .from("notification_settings")
        .select("*")
        .eq("business_id", business.id)
        .single(),
      supabase
        .from("phone_numbers")
        .select("*")
        .eq("business_id", business.id)
        .eq("is_active", true),
    ]);

    return success({
      businessId: business.id,
      business: {
        name: business.name,
        plan_id: business.plan_id,
        subscription_status: business.subscription_status,
        minutes_used_this_cycle: business.minutes_used_this_cycle,
        minutes_included: business.minutes_included,
        current_cycle_start: business.current_cycle_start,
        current_cycle_end: business.current_cycle_end,
        stripe_customer_id: business.stripe_customer_id,
      },
      callSettings: callSettings || null,
      aiConfig: aiConfig || null,
      calendarIntegration: calendarIntegration || null,
      notificationSettings: notificationSettings || null,
      phoneNumbers: phoneNumbers || [],
    });
  } catch (error) {
    logError("Settings GET", error);
    return errors.internalError("Failed to fetch settings");
  }
}

// Apply auth middleware with rate limiting: 60 req/min per user (Spec Part 20)
export const GET = withAuth(handleGet);
