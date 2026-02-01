/**
 * Campaign Process API Route
 * /api/dashboard/campaigns/[id]/process
 *
 * POST: Manually trigger processing of campaign queue items
 * Used for testing when Inngest background jobs aren't running
 */

import { NextRequest } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError, logInfo } from "@/lib/logging";
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function handlePost(
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

    // Verify campaign exists and belongs to business
    const { data: campaign } = await adminSupabase
      .from("outbound_campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("business_id", business.id)
      .single();

    if (!campaign) {
      return errors.notFound("Campaign");
    }

    if (campaign.status !== "running") {
      return errors.badRequest("Campaign must be running to process calls");
    }

    // Pre-flight check: Verify business has required configuration
    const [phoneResult, aiConfigResult] = await Promise.all([
      adminSupabase
        .from("phone_numbers")
        .select("number")
        .eq("business_id", business.id)
        .eq("is_active", true)
        .limit(1)
        .single(),
      adminSupabase
        .from("ai_config")
        .select("retell_agent_id")
        .eq("business_id", business.id)
        .single(),
    ]);

    if (phoneResult.error || !phoneResult.data?.number) {
      return errors.badRequest("No active phone number configured. Go to Settings > Phone to add one.");
    }

    if (aiConfigResult.error || !aiConfigResult.data?.retell_agent_id) {
      return errors.badRequest("AI agent not configured. Complete onboarding or go to Settings > AI to configure.");
    }

    // Get pending queue items for this campaign
    const { data: queueItems, error: queueError } = await adminSupabase
      .from("outbound_call_queue")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(10); // Process up to 10 at a time

    if (queueError) {
      throw queueError;
    }

    if (!queueItems || queueItems.length === 0) {
      return success({
        message: "No pending calls to process",
        processed: 0,
      });
    }

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each queue item
    for (const item of queueItems) {
      results.processed++;

      // Mark as calling
      await adminSupabase
        .from("outbound_call_queue")
        .update({ status: "calling", last_attempt_at: new Date().toISOString() })
        .eq("id", item.id);

      try {
        const dynamicVars = (item.dynamic_variables || {}) as Record<string, unknown>;

        // Dynamic import to avoid circular dependencies
        const { initiateOutboundCall } = await import("@/lib/outbound");
        logInfo("Campaign Process", `Initiating call to ${item.contact_phone} for business ${business.id}`);

        const callResult = await initiateOutboundCall(business.id, item.contact_phone, {
          purpose:
            (dynamicVars.campaign_type as string) === "appointment_reminder"
              ? "reminder"
              : (dynamicVars.campaign_type as string) === "follow_up"
                ? "followup"
                : "custom",
          customMessage: dynamicVars.custom_message as string | undefined,
          metadata: {
            campaign_id: campaignId,
            contact_name: item.contact_name || "",
            ...(dynamicVars as Record<string, string>),
          },
        });

        logInfo("Campaign Process", `Call result: ${JSON.stringify(callResult)}`);

        if (callResult.success) {
          results.succeeded++;
          await adminSupabase
            .from("outbound_call_queue")
            .update({
              status: "calling",  // Keep as "calling" until webhook updates with final outcome
              call_id: callResult.callId,
              retell_call_id: callResult.retellCallId,
              outcome: "initiated",  // Will be updated by webhook when call ends
              attempt_count: (item.attempt_count || 0) + 1,
            })
            .eq("id", item.id);

          logInfo("Campaign Process", `Call initiated for ${item.contact_phone}`);
        } else {
          results.failed++;
          const errorDetail = `${item.contact_phone}: ${callResult.error || "Unknown error"} (reason: ${callResult.reason || "unknown"})`;
          results.errors.push(errorDetail);
          logError("Campaign Process", `CALL FAILED: ${errorDetail}`);

          const newAttemptCount = (item.attempt_count || 0) + 1;
          const maxAttempts = item.max_attempts || 3;

          await adminSupabase
            .from("outbound_call_queue")
            .update({
              status: newAttemptCount >= maxAttempts ? "failed" : "pending",
              last_error: callResult.error,
              attempt_count: newAttemptCount,
            })
            .eq("id", item.id);
        }
      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        results.errors.push(`${item.contact_phone}: ${errorMsg}`);

        await adminSupabase
          .from("outbound_call_queue")
          .update({
            status: "failed",
            last_error: errorMsg,
            attempt_count: (item.attempt_count || 0) + 1,
          })
          .eq("id", item.id);
      }
    }

    logInfo(
      "Campaign Process",
      `Processed ${results.processed} calls for campaign ${campaignId}: ${results.succeeded} succeeded, ${results.failed} failed`
    );

    return success(results);
  } catch (error) {
    logError("Campaign Process", error);
    return errors.internalError("Failed to process campaign calls");
  }
}

// Apply auth middleware - cast needed for route context support
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const POST = withAuth(handlePost as any);
