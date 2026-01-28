/**
 * Campaign Debug API Route
 * /api/dashboard/campaigns/[id]/debug
 *
 * GET: Check campaign configuration and identify missing requirements
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
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function handleGet(
  _request: NextRequest,
  { business }: BusinessAuthContext,
  context?: RouteContext
) {
  try {
    if (!context) {
      return errors.badRequest("Invalid request");
    }
    const { id: campaignId } = await context.params;

    const adminSupabase = createAdminClient() as AnySupabaseClient;

    const checks: Record<string, { ok: boolean; message: string; value?: unknown }> = {};

    // Check 1: Campaign exists
    const { data: campaign } = await adminSupabase
      .from("outbound_campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("business_id", business.id)
      .single();

    checks.campaign = campaign
      ? {
          ok: true,
          message: "Campaign found",
          value: { id: campaign.id, name: campaign.name, status: campaign.status },
        }
      : { ok: false, message: "Campaign not found" };

    if (!campaign) {
      return success({ ready: false, checks });
    }

    // Check 2: Campaign has contacts
    const settings = (campaign.settings || {}) as Record<string, unknown>;
    const contactIds = (settings.contact_ids as string[]) || [];
    checks.contacts =
      contactIds.length > 0
        ? { ok: true, message: `${contactIds.length} contacts configured`, value: contactIds.length }
        : { ok: false, message: "No contacts configured in campaign" };

    // Check 3: Queue items exist
    const { count: queueCount } = await adminSupabase
      .from("outbound_call_queue")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

    const { count: pendingCount } = await adminSupabase
      .from("outbound_call_queue")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("status", "pending");

    checks.queue =
      queueCount && queueCount > 0
        ? {
            ok: true,
            message: `${queueCount} queue items (${pendingCount} pending)`,
            value: { total: queueCount, pending: pendingCount },
          }
        : { ok: false, message: "No queue items. Start the campaign to populate the queue." };

    // Check 4: Outbound settings
    const { data: outboundSettings } = await adminSupabase
      .from("outbound_settings")
      .select("*")
      .eq("business_id", business.id)
      .single();

    if (outboundSettings) {
      checks.outboundSettings = outboundSettings.outbound_enabled
        ? {
            ok: true,
            message: "Outbound enabled",
            value: { enabled: true, dailyLimit: outboundSettings.outbound_daily_limit },
          }
        : { ok: false, message: "Outbound calling is disabled" };
    } else {
      checks.outboundSettings = {
        ok: false,
        message: "Outbound settings not configured. Start the campaign to auto-create.",
      };
    }

    // Check 5: Phone number
    const { data: phoneNumber } = await adminSupabase
      .from("phone_numbers")
      .select("number, is_active")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .limit(1)
      .single();

    checks.phoneNumber = phoneNumber
      ? { ok: true, message: `Active phone number: ${phoneNumber.number}` }
      : { ok: false, message: "No active phone number. Configure a Twilio number in settings." };

    // Check 6: AI/Retell agent
    const { data: aiConfig } = await adminSupabase
      .from("ai_config")
      .select("retell_agent_id, ai_name")
      .eq("business_id", business.id)
      .single();

    checks.aiAgent = aiConfig?.retell_agent_id
      ? {
          ok: true,
          message: `AI agent configured: ${aiConfig.ai_name || "Koya"}`,
          value: aiConfig.retell_agent_id,
        }
      : { ok: false, message: "No AI agent configured. Complete onboarding to create an agent." };

    // Check 7: Retell API configured
    const { isRetellConfigured } = await import("@/lib/retell");
    checks.retellApi = isRetellConfigured()
      ? { ok: true, message: "Retell API key configured" }
      : { ok: false, message: "Retell API key not configured (running in mock mode)" };

    // Summary
    const allPassed = Object.values(checks).every((c) => c.ok);
    const failedChecks = Object.entries(checks)
      .filter(([, c]) => !c.ok)
      .map(([name, c]) => `${name}: ${c.message}`);

    return success({
      ready: allPassed,
      summary: allPassed
        ? "Campaign is ready to make calls"
        : `Missing requirements: ${failedChecks.join("; ")}`,
      checks,
      nextSteps: allPassed
        ? [
            "1. Ensure the campaign status is 'running'",
            "2. Call POST /api/dashboard/campaigns/[id]/process to manually trigger calls",
            "3. Or wait for the background job to process (runs every 5 minutes)",
          ]
        : [
            ...(!checks.contacts.ok ? ["Add contacts to the campaign"] : []),
            ...(!checks.queue.ok && checks.contacts.ok
              ? ["Start the campaign to populate the queue"]
              : []),
            ...(!checks.phoneNumber.ok
              ? ["Configure a Twilio phone number in Settings > Phone"]
              : []),
            ...(!checks.aiAgent.ok ? ["Complete onboarding to create an AI agent"] : []),
            ...(!checks.retellApi.ok ? ["Set RETELL_API_KEY in environment variables"] : []),
          ],
    });
  } catch (error) {
    logError("Campaign Debug", error);
    return errors.internalError("Failed to debug campaign");
  }
}

// Apply auth middleware - cast needed for route context support
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET = withAuth(handleGet as any);
