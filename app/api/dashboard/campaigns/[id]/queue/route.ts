/**
 * Campaign Queue API Route
 * /api/dashboard/campaigns/[id]/queue
 *
 * GET: Fetch all queue items for a campaign with real-time status
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
  request: NextRequest,
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

    // Fetch all queue items for this campaign
    const { data: queueItems, error: queueError } = await adminSupabase
      .from("outbound_call_queue")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });

    if (queueError) {
      throw queueError;
    }

    // Calculate stats
    const items = queueItems || [];
    const stats = {
      total: items.length,
      pending: items.filter((i) => i.status === "pending").length,
      calling: items.filter((i) => i.status === "calling").length,
      completed: items.filter((i) => i.status === "completed").length,
      failed: items.filter((i) => i.status === "failed").length,
      declined: items.filter((i) => i.status === "declined").length,
      dnc_blocked: items.filter((i) => i.status === "dnc_blocked").length,
      no_answer: items.filter((i) => i.status === "no_answer").length,
    };

    // Transform queue items for the UI
    const calls = items.map((item) => ({
      id: item.id,
      contact_name: item.contact_name || "Unknown",
      contact_phone: item.contact_phone,
      status: item.status,
      outcome: item.outcome,
      duration_seconds: item.duration_seconds || 0,
      attempt_count: item.attempt_count || 0,
      max_attempts: item.max_attempts || 3,
      last_error: item.last_error,
      call_id: item.call_id,
      retell_call_id: item.retell_call_id,
      created_at: item.created_at,
      updated_at: item.updated_at,
      last_attempt_at: item.last_attempt_at,
    }));

    return success({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        type: campaign.type,
      },
      calls,
      stats,
    });
  } catch (error) {
    logError("Campaign Queue GET", error);
    return errors.internalError("Failed to fetch campaign queue");
  }
}

// Apply auth middleware
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET = withAuth(handleGet as any);
