/**
 * Configuration Status API Route
 * /api/dashboard/config/status
 *
 * GET: Returns comprehensive configuration status for debugging
 * Shows both ENV variables and database configuration
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logging";
import { getIntegrationsStatus } from "@/lib/integrations/status";
import { isRetellConfigured } from "@/lib/retell";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export const dynamic = "force-dynamic";

interface ConfigCheck {
  name: string;
  configured: boolean;
  value?: string | boolean | number | null;
  message: string;
  fix?: string;
}

async function handleGet(
  _request: NextRequest,
  { business }: BusinessAuthContext
) {
  try {
    const adminSupabase = createAdminClient() as AnySupabaseClient;
    const checks: ConfigCheck[] = [];

    // 1. Check ENV variables (integration status)
    const integrationStatus = getIntegrationsStatus();

    checks.push({
      name: "Retell API Key (ENV)",
      configured: integrationStatus.integrations.retell.status === "connected",
      message: integrationStatus.integrations.retell.description,
      fix: integrationStatus.integrations.retell.status !== "connected"
        ? "Set RETELL_API_KEY in your environment variables"
        : undefined,
    });

    checks.push({
      name: "Twilio Credentials (ENV)",
      configured: integrationStatus.integrations.twilio.status === "connected",
      message: integrationStatus.integrations.twilio.description,
      fix: integrationStatus.integrations.twilio.status !== "connected"
        ? "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your environment variables"
        : undefined,
    });

    // 2. Check database: AI Config
    const { data: aiConfig, error: aiConfigError } = await adminSupabase
      .from("ai_config")
      .select("retell_agent_id, retell_agent_id_spanish, voice_id, personality, ai_name")
      .eq("business_id", business.id)
      .single();

    if (aiConfigError) {
      checks.push({
        name: "AI Config Row",
        configured: false,
        message: `No AI config found in database: ${aiConfigError.message}`,
        fix: "Go to Settings > AI and click 'Configure AI Agent' to create one",
      });
    } else {
      checks.push({
        name: "AI Config Row",
        configured: true,
        value: aiConfig.ai_name || "Koya",
        message: "AI config exists in database",
      });
    }

    const hasRetellAgentId = aiConfig?.retell_agent_id !== null && aiConfig?.retell_agent_id !== undefined;
    checks.push({
      name: "Retell Agent ID (Database)",
      configured: hasRetellAgentId,
      value: hasRetellAgentId ? aiConfig.retell_agent_id : null,
      message: hasRetellAgentId
        ? `Agent ID: ${aiConfig.retell_agent_id}`
        : "No Retell agent ID in database",
      fix: !hasRetellAgentId
        ? "Go to Settings > AI and click 'Configure AI Agent'"
        : undefined,
    });

    // 3. Check database: Phone Numbers
    const { data: phoneNumbers, error: phoneError } = await adminSupabase
      .from("phone_numbers")
      .select("id, number, is_active, setup_type")
      .eq("business_id", business.id);

    if (phoneError) {
      checks.push({
        name: "Phone Numbers Query",
        configured: false,
        message: `Error fetching phone numbers: ${phoneError.message}`,
      });
    } else {
      const activePhones = (phoneNumbers || []).filter((p: { is_active: boolean }) => p.is_active);

      checks.push({
        name: "Phone Numbers (Database)",
        configured: activePhones.length > 0,
        value: activePhones.length > 0 ? activePhones[0].number : null,
        message: activePhones.length > 0
          ? `${activePhones.length} active phone number(s): ${activePhones.map((p: { number: string }) => p.number).join(", ")}`
          : `No active phone numbers. Found ${phoneNumbers?.length || 0} total phone records.`,
        fix: activePhones.length === 0
          ? "Go to Settings > Phone & Billing to add a phone number"
          : undefined,
      });

      // Also log all phone records for debugging
      if (phoneNumbers && phoneNumbers.length > 0) {
        checks.push({
          name: "Phone Numbers Detail",
          configured: true,
          value: phoneNumbers.length,
          message: phoneNumbers.map((p: { number: string; is_active: boolean; setup_type: string }) =>
            `${p.number} (active: ${p.is_active}, type: ${p.setup_type})`
          ).join("; "),
        });
      }
    }

    // 4. Check database: Call Settings
    const { data: callSettings, error: callError } = await adminSupabase
      .from("call_settings")
      .select("transfer_number, backup_transfer_number")
      .eq("business_id", business.id)
      .single();

    if (callError && callError.code !== "PGRST116") {
      // PGRST116 = no rows returned
      checks.push({
        name: "Call Settings",
        configured: false,
        message: `Error fetching call settings: ${callError.message}`,
      });
    } else {
      checks.push({
        name: "Call Settings",
        configured: !!callSettings,
        value: callSettings?.transfer_number || null,
        message: callSettings
          ? `Transfer number: ${callSettings.transfer_number || "not set"}`
          : "No call settings configured (optional)",
      });
    }

    // 5. Check database: Calendar Integration
    const { data: calendar, error: calendarError } = await adminSupabase
      .from("calendar_integrations")
      .select("provider, access_token, grant_id")
      .eq("business_id", business.id)
      .single();

    if (calendarError && calendarError.code !== "PGRST116") {
      checks.push({
        name: "Calendar Integration",
        configured: false,
        message: `Error fetching calendar: ${calendarError.message}`,
      });
    } else {
      const calendarConnected = calendar &&
        calendar.provider !== "built_in" &&
        (calendar.access_token !== null || calendar.grant_id !== null);

      checks.push({
        name: "Calendar Integration",
        configured: !!calendarConnected,
        value: calendar?.provider || null,
        message: calendarConnected
          ? `Connected via ${calendar.provider} (${calendar.grant_id ? "Nylas grant_id" : "access_token"})`
          : calendar?.provider === "built_in"
            ? "Using built-in calendar"
            : "No external calendar connected (optional)",
      });
    }

    // 6. Check database: Business Hours
    const { data: hours, error: hoursError } = await adminSupabase
      .from("business_hours")
      .select("day_of_week, is_closed, open_time, close_time")
      .eq("business_id", business.id);

    if (hoursError) {
      checks.push({
        name: "Business Hours",
        configured: false,
        message: `Error fetching business hours: ${hoursError.message}`,
      });
    } else {
      const openDays = (hours || []).filter((h: { is_closed: boolean }) => !h.is_closed);
      checks.push({
        name: "Business Hours",
        configured: openDays.length > 0,
        value: openDays.length,
        message: openDays.length > 0
          ? `${openDays.length} day(s) with open hours configured`
          : "No business hours set (all days closed)",
        fix: openDays.length === 0
          ? "Go to Settings > Availability to set business hours"
          : undefined,
      });
    }

    // 7. Check database: Services
    const { data: services, error: servicesError } = await adminSupabase
      .from("services")
      .select("id, name")
      .eq("business_id", business.id);

    if (servicesError) {
      checks.push({
        name: "Services",
        configured: false,
        message: `Error fetching services: ${servicesError.message}`,
      });
    } else {
      checks.push({
        name: "Services",
        configured: (services?.length || 0) > 0,
        value: services?.length || 0,
        message: (services?.length || 0) > 0
          ? `${services?.length} service(s) configured`
          : "No services configured",
        fix: (services?.length || 0) === 0
          ? "Go to Koya's Knowledge > Services to add services"
          : undefined,
      });
    }

    // 8. Check Retell library status
    checks.push({
      name: "Retell Library Status",
      configured: isRetellConfigured(),
      message: isRetellConfigured()
        ? "Retell SDK is configured and ready"
        : "Retell SDK running in mock mode (RETELL_API_KEY not set)",
      fix: !isRetellConfigured()
        ? "Set RETELL_API_KEY environment variable to enable voice calls"
        : undefined,
    });

    // Summary
    const criticalChecks = [
      "Retell Agent ID (Database)",
      "Phone Numbers (Database)",
    ];

    const criticalFailed = checks
      .filter((c) => criticalChecks.includes(c.name) && !c.configured)
      .map((c) => c.name);

    const envFailed = checks
      .filter((c) => c.name.includes("(ENV)") && !c.configured)
      .map((c) => c.name);

    return success({
      businessId: business.id,
      businessName: business.name,
      summary: {
        allCriticalConfigured: criticalFailed.length === 0,
        allEnvConfigured: envFailed.length === 0,
        criticalMissing: criticalFailed,
        envMissing: envFailed,
        canMakeCalls: criticalFailed.length === 0 && isRetellConfigured(),
        canReceiveCalls: criticalFailed.length === 0 && isRetellConfigured(),
      },
      checks,
    });
  } catch (error) {
    logError("Config Status", error);
    return errors.internalError("Failed to get configuration status");
  }
}

export const GET = withAuth(handleGet);
